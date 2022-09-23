// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import * as chai from "chai";
import sinon from "sinon";
import fs from "fs-extra";
import path from "path";
import { v4 as uuid } from "uuid";
import { ConfigMap, PluginContext, ok, Platform, Plugin } from "@microsoft/teamsfx-api";
import { AppStudioPlugin } from "./../../../../../src/plugins/resource/appstudio";
import { AppStudioPluginImpl } from "./../../../../../src/plugins/resource/appstudio/plugin";
import { AppStudioClient } from "./../../../../../src/plugins/resource/appstudio/appStudio";
import { PublishingState } from "./../../../../../src/plugins/resource/appstudio/interfaces/IPublishingAppDefinition";
import { AppDefinition } from "./../../../../../src/plugins/resource/appstudio/interfaces/appDefinition";
import { getAzureProjectRoot, MockUserInteraction } from "./../helper";
import { LocalCrypto } from "../../../../../src/core/crypto";
import { Constants } from "../../../../../src/plugins/resource/appstudio/constants";
import { newEnvInfo } from "../../../../../src/core/environment";
import { mockTokenProviderM365 } from "../../../../component/resource/aadApp/helper";

describe("Publish Teams app with Azure", () => {
  let plugin: AppStudioPlugin;
  let ctx: PluginContext;
  const sandbox = sinon.createSandbox();
  const appPackagePath = path.resolve(__dirname, "./../resources/appPackage/appPackage.zip");
  const appDef: AppDefinition = {
    appName: "fake",
    teamsAppId: uuid(),
    userList: [],
  };

  beforeEach(async () => {
    plugin = new AppStudioPlugin();
    ctx = {
      root: getAzureProjectRoot(),
      envInfo: newEnvInfo(),
      config: new ConfigMap(),
      m365TokenProvider: mockTokenProviderM365(),
      answers: { platform: Platform.VSCode },
      cryptoProvider: new LocalCrypto(""),
    };
    ctx.projectSettings = {
      appName: "my app",
      projectId: "project id",
      solutionSettings: {
        name: "azure",
        version: "1.0",
        capabilities: ["Bot"],
        activeResourcePlugins: ["fx-resource-bot"],
      },
    };

    sandbox.stub(AppStudioClient, "publishTeamsApp").resolves(uuid());
    sandbox.stub(AppStudioClient, "publishTeamsAppUpdate").resolves(uuid());
    sandbox.stub(AppStudioClient, "importApp").resolves(appDef);
    sandbox.stub(fs, "move").resolves();
  });

  afterEach(async () => {
    sandbox.restore();
    if (await fs.pathExists(appPackagePath)) {
      await fs.remove(appPackagePath);
    }
  });

  it("Publish teams app", async () => {
    sandbox.stub(AppStudioClient, "getAppByTeamsAppId").resolves(undefined);

    sandbox.stub(AppStudioPluginImpl.prototype, "getConfigForCreatingManifest" as any).returns({
      tabEndpoint: "https://tabEndpoint",
      tabDomain: "tabDomain",
      tabIndexPath: "/index",
      aadId: uuid(),
      botDomain: "botDomain",
      botId: uuid(),
      webApplicationInfoResource: "webApplicationInfoResource",
      teamsAppId: uuid(),
    });

    const newCtx: PluginContext = Object.create(ctx);
    const links: string[] = [];
    newCtx.ui = new MockUserInteraction();
    sandbox
      .stub(MockUserInteraction.prototype, "showMessage")
      .callsFake((level, message, modal, ...items) => {
        if (items.includes("Go to admin portal")) {
          return Promise.resolve(ok("Go to admin portal"));
        }
        return Promise.resolve(ok(undefined));
      });
    sandbox.stub(MockUserInteraction.prototype, "openUrl").callsFake((link) => {
      links.push(link);
      return Promise.resolve(ok(true));
    });

    const teamsAppId = await plugin.publish(newCtx);
    chai.assert.include(links, Constants.TEAMS_ADMIN_PORTAL);
    chai.assert.isTrue(teamsAppId.isOk());
    if (teamsAppId.isOk()) {
      chai.assert.isNotEmpty(teamsAppId.value);
    }
  });

  it("Update a submitted app", async () => {
    const mockApp = {
      lastModifiedDateTime: null,
      publishingState: PublishingState.submitted,
      teamsAppId: uuid(),
      displayName: "TestApp",
    };
    sandbox.stub(AppStudioClient, "getAppByTeamsAppId").resolves(mockApp);
    ctx.ui = new MockUserInteraction();

    sandbox.stub(AppStudioPluginImpl.prototype, "getConfigForCreatingManifest" as any).returns({
      tabEndpoint: "https://tabEndpoint",
      tabDomain: "tabDomain",
      tabIndexPath: "/index",
      aadId: uuid(),
      botDomain: "botDomain",
      botId: uuid(),
      webApplicationInfoResource: "webApplicationInfoResource",
      teamsAppId: uuid(),
    });

    const teamsAppId = await plugin.publish(ctx);
    chai.assert.isTrue(teamsAppId.isOk());
    if (teamsAppId.isOk()) {
      chai.assert.isNotEmpty(teamsAppId.value);
    }
  });
});

describe("Publish Teams app with SPFx", () => {
  let plugin: AppStudioPlugin;
  let ctx: PluginContext;
  const sandbox = sinon.createSandbox();
  const appPackagePath = path.resolve(__dirname, "./../spfx-resources/appPackage/appPackage.zip");

  beforeEach(async () => {
    plugin = new AppStudioPlugin();
    ctx = {
      root: path.resolve(__dirname, "./../spfx-resources"),
      envInfo: newEnvInfo(),
      config: new ConfigMap(),
      m365TokenProvider: mockTokenProviderM365(),
      answers: { platform: Platform.VSCode },
      cryptoProvider: new LocalCrypto(""),
    };
    ctx.projectSettings = {
      appName: "my app",
      projectId: "project id",
      solutionSettings: {
        name: "spfx",
        version: "1.0",
        capabilities: ["Tab"],
        activeResourcePlugins: ["fx-resource-spfx"],
      },
    };
    sandbox.stub(AppStudioClient, "publishTeamsApp").resolves(uuid());
    sandbox.stub(AppStudioClient, "publishTeamsAppUpdate").resolves(uuid());
    sandbox.stub(fs, "move").resolves();
    sandbox.stub(AppStudioPluginImpl.prototype, <any>"beforePublish").returns(uuid());
  });

  afterEach(async () => {
    sandbox.restore();
    if (await fs.pathExists(appPackagePath)) {
      await fs.remove(appPackagePath);
    }
  });

  it("Publish teams app", async () => {
    sandbox.stub(AppStudioClient, "getAppByTeamsAppId").resolves(undefined);

    sandbox.stub(AppStudioPluginImpl.prototype, "getConfigForCreatingManifest" as any).returns(
      ok({
        tabEndpoint: "tabEndpoint",
        tabDomain: "tabDomain",
        aadId: "aadId",
        webApplicationInfoResource: "webApplicationInfoResource",
        teamsAppId: uuid(),
      })
    );

    const teamsAppId = await plugin.publish(ctx);
    chai.assert.isTrue(teamsAppId.isOk());
    if (teamsAppId.isOk()) {
      chai.assert.isNotEmpty(teamsAppId.value);
    }
  });

  it("Update a submitted app", async () => {
    const mockApp = {
      lastModifiedDateTime: null,
      publishingState: PublishingState.submitted,
      teamsAppId: uuid(),
      displayName: "TestApp",
    };
    sandbox.stub(AppStudioClient, "getAppByTeamsAppId").resolves(mockApp);
    ctx.ui = new MockUserInteraction();

    sandbox.stub(AppStudioPluginImpl.prototype, "getConfigForCreatingManifest" as any).returns(
      ok({
        tabEndpoint: "tabEndpoint",
        tabDomain: "tabDomain",
        aadId: "aadId",
        webApplicationInfoResource: "webApplicationInfoResource",
        teamsAppId: uuid(),
      })
    );

    const teamsAppId = await plugin.publish(ctx);
    chai.assert.isTrue(teamsAppId.isOk());
    if (teamsAppId.isOk()) {
      chai.assert.isNotEmpty(teamsAppId.value);
    }
  });
});
