import JobsMgr from './JobsMgr';
import EmitteryJobsMgr from './EmitteryJobsMgr';
import RedisJobsMgr from './RedisJobsMgr';
import { Server } from 'socket.io';
import { Worker } from 'worker_threads';

enum JobStatus {
  PROGRESS = 'PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export default class NocoJobs {
  private static instance: NocoJobs;
  private client: JobsMgr;
  private sv: Server;
  private jobs: any;

  private constructor(sv: Server) {
    this.sv = sv;
    this.jobs = [];
    if (process.env.NC_REDIS_URL) {
      this.client = new RedisJobsMgr(process.env.NC_REDIS_URL);
    } else {
      this.client = new EmitteryJobsMgr();
    }
  }

  public static getInstance(sv?: Server): NocoJobs {
    if (!NocoJobs.instance) {
      if (sv) {
        NocoJobs.instance = new NocoJobs(sv);
      } else {
        throw new Error('NocoJobs not initialized');
      }
    }
    return NocoJobs.instance;
  }

  private progress(jobId: string, data: { msg?: string; level?: any; status?: string }): void {
    this.sv.to(jobId).emit('progress', data);
  }

  public get jobsMgr(): JobsMgr {
    return this.client;
  }

  public get list(): any {
    return this.jobs;
  }

  public run(jobId: string, workerPath: string, data: any, finalCb: any = () => {}): Worker {
    const fnd = this.jobs.find((j) => j.id === jobId);
    if (fnd) {
      return fnd.worker;
    }

    const tempJob = {
      id: jobId,
      worker: null,
      created_at: Date.now(),
      updated_at: Date.now(),
      last_message: 'Job started',
    };

    tempJob.worker = new Worker(workerPath);
    tempJob.worker.on('message', (message) => {
      this.progress(jobId, message);
      tempJob.last_message = message;
      tempJob.updated_at = Date.now();
    });

    tempJob.worker.on('error', (error) => {
      this.progress(jobId, { msg: error?.message || 'Failed due to some internal error', status: JobStatus.FAILED });
    });

    tempJob.worker.on('exit', (code) => {
      finalCb();
      if (code === 0) {
        this.progress(jobId, {
          msg: 'Complete!',
          status: JobStatus.COMPLETED,
        });
      }
      const jb = this.jobs.find((j) => j.id === jobId);
      if (jb) this.jobs.splice(this.jobs.findIndex(jb), 1)
    });

    tempJob.worker.postMessage(data);

    this.jobs.push(tempJob);

    return tempJob.worker;
  }

  public async stop(jobId: string): Promise<void> {
    return new Promise((resolve) => {
      const fnd = this.jobs.find((j) => j.id === jobId);
      if (!fnd) {
        return resolve();
      }

      fnd.worker.terminate().then(() => {
        resolve();
      });
    });
  }

  public isRunning(jobId: string): boolean {
    return !!this.jobs.find((j) => j.id === jobId);
  }

  public getJob(jobId: string): any {
    return this.jobs.find((j) => j.id === jobId);
  }
}
