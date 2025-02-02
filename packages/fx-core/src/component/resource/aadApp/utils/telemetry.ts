// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { PluginContext } from "@microsoft/teamsfx-api";
import { TOOLS } from "../../../../core/globalVars";
import { solutionGlobalVars } from "../../../../plugins/solution/fx-solution/v3/solutionGlobalVars";
import { Plugins, Telemetry } from "../constants";

export class TelemetryUtils {
  public static init(ctx: PluginContext): void {}

  public static sendEvent(
    eventName: string,
    properties?: { [key: string]: string },
    measurements?: { [key: string]: number }
  ): void {
    if (!properties) {
      properties = {};
    }
    properties[Telemetry.component] = Plugins.pluginNameComplex;
    TelemetryUtils.addAppIdInProperty(properties);
    TOOLS.telemetryReporter?.sendTelemetryEvent(eventName, properties, measurements);
  }

  public static sendSuccessEvent(
    eventName: string,
    properties?: { [key: string]: string },
    measurements?: { [key: string]: number }
  ): void {
    if (!properties) {
      properties = {};
    }
    properties[Telemetry.isSuccess] = Telemetry.yes;
    TelemetryUtils.sendEvent(eventName, properties, measurements);
  }

  public static sendErrorEvent(
    eventName: string,
    errorName: string,
    errorType: string,
    errorMessage: string,
    properties?: { [key: string]: string },
    measurements?: { [key: string]: number }
  ): void {
    if (!properties) {
      properties = {};
    }

    properties[Telemetry.component] = Plugins.pluginNameComplex;
    properties[Telemetry.errorCode] = `${Plugins.pluginNameShort}.${errorName}`;
    properties[Telemetry.errorType] = errorType;
    properties[Telemetry.errorMessage] = errorMessage;
    properties[Telemetry.isSuccess] = Telemetry.no;
    TelemetryUtils.addAppIdInProperty(properties);
    TOOLS.telemetryReporter?.sendTelemetryErrorEvent(eventName, properties, measurements);
  }

  static readonly getErrorProperty = (errorType: string, errorMessage: string) => {
    return {
      "error-type": errorType,
      "error-message": errorMessage,
    };
  };

  private static addAppIdInProperty(properties: { [key: string]: string }): void {
    const appId = solutionGlobalVars.TeamsAppId || "";
    properties[Telemetry.appId] = appId as string;
  }
}
