// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import "mocha";

import * as chai from "chai";
import chaiAsPromised from "chai-as-promised";
import fs from "fs-extra";
import * as path from "path";

import { AzureSolutionSettings, PluginContext } from "@microsoft/teamsfx-api";
import { TestHelper } from "../helper";
import { FrontendPlugin } from "../../../../../src/plugins/resource/frontend";
import { ConstantString, mockSolutionGenerateArmTemplates, ResourcePlugins } from "../../util";
import {
  HostTypeOptionAzure,
  TabOptionItem,
} from "../../../../../src/plugins/solution/fx-solution/question";

chai.use(chaiAsPromised);

describe("FrontendGenerateArmTemplates", () => {
  let frontendPlugin: FrontendPlugin;

  beforeEach(() => {
    frontendPlugin = new FrontendPlugin();
  });

  it("generate bicep arm templates", async () => {
    // Act
    const activeResourcePlugins = [
      ResourcePlugins.Aad,
      ResourcePlugins.SimpleAuth,
      ResourcePlugins.FrontendHosting,
    ];
    const pluginContext: PluginContext = TestHelper.getFakePluginContext();
    pluginContext.projectSettings!.solutionSettings = {
      hostType: HostTypeOptionAzure.id,
      name: "azure",
      activeResourcePlugins: activeResourcePlugins,
      capabilities: [TabOptionItem.id],
    } as AzureSolutionSettings;
    const result = await frontendPlugin.generateArmTemplates(pluginContext);

    // Assert
    const testModuleFileName = "frontendProvision.result.bicep";
    const mockedSolutionDataContext = {
      Plugins: {
        "fx-resource-frontend-hosting": {
          Provision: {
            frontendHosting: {
              path: `./${testModuleFileName}`,
            },
          },
        },
      },
    };
    chai.assert.isTrue(result.isOk());
    if (result.isOk()) {
      const expectedResult = mockSolutionGenerateArmTemplates(
        mockedSolutionDataContext,
        result.value
      );

      const expectedBicepFileDirectory = path.join(__dirname, "expectedBicepFiles");
      const expectedModuleFilePath = path.join(expectedBicepFileDirectory, testModuleFileName);
      const moduleFile = await fs.readFile(expectedModuleFilePath, ConstantString.UTF8Encoding);
      chai.assert.strictEqual(expectedResult.Provision!.Modules!.frontendHosting, moduleFile);
      const expectedModuleSnippetFilePath = path.join(
        expectedBicepFileDirectory,
        "provision.result.bicep"
      );
      const OrchestrationConfigFile = await fs.readFile(
        expectedModuleSnippetFilePath,
        ConstantString.UTF8Encoding
      );
      chai.assert.strictEqual(expectedResult.Provision!.Orchestration, OrchestrationConfigFile);
      chai.assert.isNotNull(expectedResult.Reference);
      chai.assert.isUndefined(expectedResult.Parameters);
    }
  });

  it("update bicep arm templates", async () => {
    // Act
    const activeResourcePlugins = [
      ResourcePlugins.Aad,
      ResourcePlugins.SimpleAuth,
      ResourcePlugins.FrontendHosting,
    ];
    const pluginContext: PluginContext = TestHelper.getFakePluginContext();
    pluginContext.projectSettings!.solutionSettings = {
      hostType: HostTypeOptionAzure.id,
      name: "azure",
      activeResourcePlugins: activeResourcePlugins,
      capabilities: [TabOptionItem.id],
    } as AzureSolutionSettings;
    const result = await frontendPlugin.updateArmTemplates(pluginContext);

    // Assert
    chai.assert.isTrue(result.isOk());
    if (result.isOk()) {
      chai.assert.exists(result.value.Reference!.endpoint);
      chai.assert.exists(result.value.Reference!.domain);
      chai.assert.strictEqual(
        result.value.Reference!.endpoint,
        "provisionOutputs.frontendHostingOutput.value.endpoint"
      );
      chai.assert.strictEqual(
        result.value.Reference!.domain,
        "provisionOutputs.frontendHostingOutput.value.domain"
      );
      chai.assert.notExists(result.value.Provision);
      chai.assert.notExists(result.value.Parameters);
      chai.assert.notExists(result.value.Configuration);
    }
  });
});
