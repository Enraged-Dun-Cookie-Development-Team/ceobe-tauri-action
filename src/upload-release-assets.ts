import fs from 'fs';
import { getInput } from '@actions/core';
import { getOctokit } from '@actions/github';

import { getAssetName } from './utils';
import type { Artifact } from './types';

export async function uploadAssets(
  owner: string,
  repo: string,
  releaseId: number,
  assets: Artifact[]
) {
  if (process.env.GITHUB_TOKEN === undefined) {
    throw new Error('GITHUB_TOKEN is required');
  }

  const github = getOctokit(process.env.GITHUB_TOKEN);

  const existingAssets = (
    await github.rest.repos.listReleaseAssets({
      owner: owner,
      repo: repo,
      release_id: releaseId,
      per_page: 50,
    })
  ).data;

  // Determine content-length for header to upload asset
  const contentLength = (filePath: string) => fs.statSync(filePath).size;

  for (const asset of assets) {
    const headers = {
      'content-type': 'application/zip',
      'content-length': contentLength(asset.path),
    };

    const assetName = getAssetName(asset.path);

    const existingAsset = existingAssets.find(
      (a) => a.name === assetName.trim().replace(/ /g, '.')
    );
    if (existingAsset) {
      console.log(`Deleting existing ${assetName}...`);
      await github.rest.repos.deleteReleaseAsset({
        owner: owner,
        repo: repo,
        asset_id: existingAsset.id,
      });
    }

    console.log(`Uploading ${assetName}...`);

    const customAssetName = getInput('customAssetName');
    console.log(`customAssetName: ${customAssetName}`);
    const uploadAssetName = customAssetName || assetName;
    console.log(`uploadAssetName: ${uploadAssetName}`);

    await github.rest.repos.uploadReleaseAsset({
      headers,
      name: uploadAssetName,
      // https://github.com/tauri-apps/tauri-action/pull/45
      // @ts-ignore error TS2322: Type 'Buffer' is not assignable to type 'string'.
      data: fs.readFileSync(asset.path),
      owner: owner,
      repo: repo,
      release_id: releaseId,
    });
  }
}
