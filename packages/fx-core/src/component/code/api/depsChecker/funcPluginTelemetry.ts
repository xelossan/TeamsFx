/* eslint-disable @typescript-eslint/no-namespace */
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as os from "os";
import { performance } from "perf_hooks";
import { SystemError, UserError } from "@microsoft/teamsfx-api";
import {
  DepsCheckerEvent,
  TelemetryMessurement,
} from "../../../../common/deps-checker/constant/telemetry";
import { DepsTelemetry } from "../../../../common/deps-checker/depsTelemetry";
import { TelemetryKey } from "../enums";
import { TelemetryHelper } from "../telemetry-helper";

class FuncPluginTelemetry implements DepsTelemetry {
  private readonly _source = "func-envchecker";

  private static getCommonProps(): { [key: string]: string } {
    const properties: { [key: string]: string } = {};
    properties[TelemetryKey.OSArch] = os.arch();
    properties[TelemetryKey.OSRelease] = os.release();
    return properties;
  }

  public sendEvent(
    eventName: DepsCheckerEvent,
    properties: { [key: string]: string } = {},
    timecost?: number
  ): void {
    const measurements: { [p: string]: number } = {};
    if (timecost) {
      measurements[TelemetryMessurement.completionTime] = timecost;
    }
    TelemetryHelper.sendSuccessEvent(
      eventName,
      { ...properties, ...FuncPluginTelemetry.getCommonProps() },
      measurements
    );
  }

  public async sendEventWithDuration(
    eventName: DepsCheckerEvent,
    action: () => Promise<void>
  ): Promise<void> {
    const start = performance.now();
    await action();

    // use seconds instead of milliseconds
    const timecost = Number(((performance.now() - start) / 1000).toFixed(2));
    const measurements: { [p: string]: number } = {};
    if (timecost) {
      measurements[TelemetryMessurement.completionTime] = timecost;
    }

    TelemetryHelper.sendSuccessEvent(eventName, FuncPluginTelemetry.getCommonProps(), measurements);
  }

  public sendUserErrorEvent(eventName: DepsCheckerEvent, errorMessage: string): void {
    const error = new UserError(this._source, eventName, errorMessage);
    TelemetryHelper.sendErrorEvent(eventName, error, FuncPluginTelemetry.getCommonProps());
  }

  public sendSystemErrorEvent(
    eventName: DepsCheckerEvent,
    errorMessage: string,
    errorStack: string
  ): void {
    const error = new SystemError(
      this._source,
      eventName,
      `errorMsg=${errorMessage},errorStack=${errorStack}`
    );
    error.stack = errorStack;
    TelemetryHelper.sendErrorEvent(eventName, error, FuncPluginTelemetry.getCommonProps());
  }
}

export const funcDepsTelemetry = new FuncPluginTelemetry();
