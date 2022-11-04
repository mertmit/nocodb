import sqlite3 from 'better-sqlite3';
import { Readable } from 'stream';

class EntityMap {
  cols: string[];
  db: any;

  constructor(...args) {
    this.cols = args.map((arg) => processKey(arg));
    this.db = new sqlite3(':memory:');

    const colStatement =
      this.cols.length > 0
        ? this.cols.join(' TEXT, ') + ' TEXT'
        : 'mpID INTEGER PRIMARY KEY';

    try {
      const stmt = this.db.prepare(`CREATE TABLE mapping (${colStatement})`);
      stmt.run();
    } catch (e) {
      console.log(e);
    }
  }

  destroy() {
    if (this.db) {
      this.db.close();
    }
  }

  addRow(row): void {
    const cols = Object.keys(row).map((key) => processKey(key));
    const colStatement = cols.map((key) => `'${key}'`).join(', ');
    const questionMarks = cols.map(() => '?').join(', ');

    for (const col of cols.filter((col) => !this.cols.includes(col))) {
      try {
        const stmt = this.db.prepare(`ALTER TABLE mapping ADD '${col}' TEXT;`);
        stmt.run();
        this.cols.push(col);
      } catch (e) {
        console.log(e);
      }
    }

    const values = Object.values(row).map((val) => {
      if (typeof val === 'object') {
        return `JSON::${JSON.stringify(val)}`;
      }
      return val;
    });
    
    try {
      const stmt = this.db.prepare(`INSERT INTO mapping (${colStatement}) VALUES (${questionMarks})`);
      stmt.run(values);
    } catch (e) {
      console.log(e);
    }
  }

  getRow(col, val, res = []): Record<string, any> {
    col = processKey(col);
    res = res.map((r) => processKey(r));
    try {
      const stmt = this.db.prepare(`SELECT ${
        res.length ? res.join(', ') : '*'
      } FROM mapping WHERE ${col} = ?`);
      let rs = stmt.get([val]);
      rs = processResponseRow(rs);
      return rs;
    } catch (e) {
      console.log(e);
      return e;
    }
  }

  getCount(): number {
    try {
      const stmt = this.db.prepare(`SELECT COUNT(*) as count FROM mapping`);
      let rs = stmt.get();
      return rs.count;
    } catch (e) {
      console.log(e);
      return e;
    }
  }

  getStream(res = []): DBStream {
    res = res.map((r) => processKey(r));
    return new DBStream(
      this.db,
      `SELECT ${res.length ? res.join(', ') : '*'} FROM mapping`
    );
  }

  getLimit(limit, offset, res = []): Record<string, any>[] {
    res = res.map((r) => processKey(r));
    try {
      const stmt = this.db.prepare(`SELECT ${
        res.length ? res.join(', ') : '*'
      } FROM mapping LIMIT ${limit} OFFSET ${offset}`);
      let rows = stmt.all();
      for (let row of rows) {
        row = processResponseRow(row);
      }
      return rows;
    } catch (e) {
      console.log(e);
      return e;
    }
  }
}

class DBStream extends Readable {
  db: any;
  stmt: any;
  sql: any;

  constructor(db, sql) {
    super({ objectMode: true });
    this.db = db;
    this.sql = sql;
    this.stmt = this.db.prepare(this.sql);
    this.on('end', () => this.stmt.finalize());
  }

  _read() {
    let stream = this;
    try {
      for (let rs of this.stmt.iterate()) {
        console.log(rs);
        if (rs) {
          rs = processResponseRow(rs);
        }
        stream.push(rs || null);
      }
    } catch (e) {
      stream.emit('error', e);
    }
  }
}

function processResponseRow(res: any) {
  for (const key of Object.keys(res)) {
    if (res[key] && typeof res[key] === 'string' && res[key].startsWith('JSON::')) {
      try {
        res[key] = JSON.parse(res[key].replace('JSON::', ''));
      } catch (e) {
        console.log(e);
      }
    }
    if (revertKey(key) !== key) {
      res[revertKey(key)] = res[key];
      delete res[key];
    }
  }
  return res;
}

function processKey(key) {
  return key.replace(/'/g, "''").replace(/[A-Z]/g, (match) => `_${match}`);
}

function revertKey(key) {
  return key.replace(/''/g, "'").replace(/_[A-Z]/g, (match) => match[1]);
}

export default EntityMap;

function test() {
  const mapper = new EntityMap();
  mapper.addRow({ test: 1, user: 1 });
  mapper.addRow({ test: 2, user: 1 });
  mapper.addRow({ test: 3, user: 1 });
  mapper.addRow({ test: 4, user: 1 });
  mapper.addRow({ test: 5, user: 2 });

  const st = mapper.getStream();
  st.on('data', (data) => {
    console.log(data);
  })


}

test();
