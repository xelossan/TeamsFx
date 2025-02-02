// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import {
  AzureAccountProvider,
  IProgressHandler,
  LogProvider,
  M365TokenProvider,
  TelemetryReporter,
} from "@microsoft/teamsfx-api";

export type Step = {
  driver: "scriptDriver" | "azureAppServiceDriver" | "azureFunctionDriver" | "azureStorageDriver";
  args: unknown;
};

export type DeployArgs = {
  src: string;
  dist: string;
  ignoreFile?: string;
  resourceId: string;
};

export type DeployStepArgs = {
  src: string;
  dist: string;
  ignoreFile?: string;
};

export type BuildArgs = {
  src: string;
  buildCommand: string;
};

export type DriverContext = {
  azureAccountProvider: AzureAccountProvider;
  m365TokenProvider: M365TokenProvider;
  progressBar: IProgressHandler | undefined;
  logProvider: LogProvider;
  telemetryReporter: TelemetryReporter;
};

export type DeployContext = {
  azureAccountProvider: AzureAccountProvider;
  progressBar: IProgressHandler | undefined;
  logProvider: LogProvider;
  telemetryReporter: TelemetryReporter;
};

export type AzureResourceInfo = {
  subscriptionId: string;
  resourceGroupName: string;
  instanceId: string;
};

export type AzureUploadConfig = {
  headers: {
    "Content-Type"?: string;
    "Cache-Control"?: string;
    Authorization: string;
  };
  maxContentLength: number;
  maxBodyLength: number;
  timeout: number;
};

export type AxiosOnlyStatusResult = {
  status?: number;
};

export type AxiosHeaderWithLocation = {
  headers: {
    location: string;
  };
};

export type AxiosZipDeployResult = AxiosHeaderWithLocation & AxiosOnlyStatusResult;
