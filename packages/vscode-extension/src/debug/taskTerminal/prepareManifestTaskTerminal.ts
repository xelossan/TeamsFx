/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";

import { FxError, Result, Void } from "@microsoft/teamsfx-api";
import {
  AppManifestDebugArgs,
  AppManifestDebugHandler,
} from "@microsoft/teamsfx-core/build/component/debugHandler";

import VsCodeLogInstance from "../../commonlib/log";
import { workspaceUri } from "../../globalVariables";
import { tools } from "../../handlers";
import { prepareManifestDisplayMessages } from "../constants";
import { BaseTaskTerminal } from "./baseTaskTerminal";
import { handleDebugActions } from "./common";

export class PrepareManifestTaskTerminal extends BaseTaskTerminal {
  private readonly args: AppManifestDebugArgs;

  constructor(taskDefinition: vscode.TaskDefinition) {
    super(taskDefinition);
    this.args = taskDefinition.args as AppManifestDebugArgs;
  }

  async do(): Promise<Result<Void, FxError>> {
    if (this.args.appPackagePath) {
      this.args.appPackagePath = BaseTaskTerminal.resolveTeamsFxVariables(this.args.appPackagePath);
    }

    VsCodeLogInstance.outputChannel.show();
    VsCodeLogInstance.info(prepareManifestDisplayMessages.title);
    VsCodeLogInstance.outputChannel.appendLine("");

    const workspacePath: string = workspaceUri?.fsPath as string;
    const handler = new AppManifestDebugHandler(
      workspacePath,
      this.args,
      tools.tokenProvider.m365TokenProvider,
      tools.logProvider,
      tools.telemetryReporter,
      tools.ui
    );
    const actions = handler.getActions();

    return await handleDebugActions(actions, prepareManifestDisplayMessages);
  }
}
