// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ProjectSettings } from "@microsoft/teamsfx-api";

export function ensureSolutionSettings(projectSettings: ProjectSettings): void {
  if (!projectSettings.solutionSettings) {
    projectSettings.solutionSettings = {
      name: "fx-solution-azure",
      version: "3.0.0",
      capabilities: [],
      azureResources: [],
      activeResourcePlugins: [],
    };
  }
}
