import { Request, Router } from 'express';
// import { Queue } from 'bullmq';
// import axios from 'axios';
import catchError from '../../helpers/catchError';
import NocoJobs from '../../../jobs/NocoJobs';
import SyncSource from '../../../models/SyncSource';
import { AirtableSyncConfig } from '../../../jobs/jobs';
import Noco from '../../../Noco';
import { genJwt } from '../userApi/helpers';
import { NcError } from '../../helpers/catchError';

const AIRTABLE_IMPORT_JOB = 'AIRTABLE_IMPORT_JOB';

export default (router: Router) => {
  const nocoJobs = NocoJobs.getInstance();

  router.post(
    '/api/v1/db/meta/import/airtable',
    catchError((req, res) => {
      nocoJobs.jobsMgr.add(AIRTABLE_IMPORT_JOB, {
        id: req.query.id,
        ...req.body,
      });
      res.json({});
    })
  );
  router.post(
    '/api/v1/db/meta/syncs/:syncId/trigger',
    catchError(async (req: Request, res) => {
      if (nocoJobs.isRunning(req.params.syncId)) {
        NcError.badRequest('Sync is already triggered!');
      }
      const syncSource = await SyncSource.get(req.params.syncId);

      const user = await syncSource.getUser();
      const token = genJwt(user, Noco.getConfig());

      // Treat default baseUrl as siteUrl from req object
      let baseURL = (req as any).ncSiteUrl;

      // if environment value avail use it
      // or if it's docker construct using `PORT`
      if (process.env.NC_BASEURL_INTERNAL) {
        baseURL = process.env.NC_BASEURL_INTERNAL;
      } else if (process.env.NC_DOCKER) {
        baseURL = `http://localhost:${process.env.PORT || 8080}`;
      }

      nocoJobs.run(req.params.syncId, './src/lib/jobs/jobs/at-compiled/build/index.js', {
        id: req.params.syncId,
        ...(syncSource?.details || {}),
        projectId: syncSource.project_id,
        authToken: token,
        baseURL,
      } as AirtableSyncConfig);

      res.json({});
    })
  );

  router.post(
    '/api/v1/db/meta/syncs/:syncId/abort',
    catchError(async (req: Request, res) => {
      if (!nocoJobs.isRunning(req.params.syncId)) {
        NcError.badRequest('Sync is not triggered!');
      }
      
      await nocoJobs.stop(req.params.syncId);
      
      res.json({});
    })
  );
};
