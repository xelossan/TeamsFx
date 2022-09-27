// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import {
  InputsWithProjectPath,
  ok,
  Platform,
  ProjectSettingsV3,
  TeamsAppManifest,
} from "@microsoft/teamsfx-api";
import * as templatesAction from "../../../src/common/template-utils/templatesActions";
import { manifestUtils } from "../../../src/component/resource/appManifest/utils/ManifestUtils";
import * as projectSettingsLoader from "../../../src/core/middleware/projectSettingsLoader";
import { assert } from "chai";
import "mocha";
import * as os from "os";
import * as path from "path";
import fs from "fs-extra";
import { createSandbox } from "sinon";
import * as utils from "../../../src/component/utils";
import { getComponent } from "../../../src/component/workflow";
import { setTools } from "../../../src/core/globalVars";
import { MockTools, randomAppName } from "../../core/utils";
import "../../../src/component/core";
import { environmentManager } from "../../../src/core/environment";
import { ComponentNames, ProgrammingLanguage } from "../../../src/component/constants";
import { FunctionScaffold } from "../../../src/component/code/api/scaffold";
import { bicepUtils } from "../../../src/component/utils";
import { Container } from "typedi";
import child_process from "child_process";
import { ApiCodeProvider } from "../../../src/component/code/api/apiCode";
import { DepsManager } from "../../../src/common/deps-checker";
import { funcDepsHelper } from "../../../src/component/code/api/depsChecker/funcHelper";
describe("Api Feature", () => {
  const sandbox = createSandbox();
  const tools = new MockTools();
  setTools(tools);
  const appName = `unittest${randomAppName()}`;
  const projectPath = path.join(os.homedir(), "TeamsApps", appName);
  const context = utils.createContextV3();
  const projectSetting: ProjectSettingsV3 = {
    appName: "",
    projectId: "",
    programmingLanguage: "typescript",
    components: [],
  };
  context.projectSetting = projectSetting;
  const manifest = {} as TeamsAppManifest;
  beforeEach(() => {
    sandbox.stub(tools.ui, "showMessage").resolves(ok("Confirm"));
    sandbox.stub(tools.ui, "inputText").resolves(ok({ type: "success", result: "getUserProfile" }));
    sandbox.stub(manifestUtils, "readAppManifest").resolves(ok(manifest));
    sandbox.stub(manifestUtils, "writeAppManifest").resolves(ok(undefined));
    sandbox.stub(projectSettingsLoader, "loadProjectSettings").resolves(ok(projectSetting));
    sandbox.stub(templatesAction, "scaffoldFromTemplates").resolves();
    sandbox.stub(fs, "readJson").resolves({});
    sandbox.stub(fs, "writeJSON").resolves();
    sandbox.stub(fs, "writeJson").resolves();
    sandbox.stub(fs, "pathExists").resolves(true);
    sandbox.stub(fs, "copyFile").resolves();
    sandbox.stub(fs, "ensureDir").resolves();
    sandbox.stub(fs, "appendFile").resolves();
    sandbox.stub(fs, "writeFile").resolves();
    sandbox.stub(fs, "ensureDirSync").returns();
    sandbox.stub(fs, "readdirSync").returns([]);
    sandbox.stub(fs, "appendFileSync").returns();
    sandbox.stub(fs, "writeFileSync").returns();
    sandbox.stub(environmentManager, "listRemoteEnvConfigs").resolves(ok(["dev"]));
    sandbox.stub(FunctionScaffold, "doesFunctionPathExist").resolves(false);
    const ssoComponent = Container.get("sso") as any;
    sandbox.stub(ssoComponent, "add").resolves(ok(undefined));
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("add api", async () => {
    sandbox.stub(bicepUtils, "persistBiceps").resolves(ok(undefined));
    const inputs: InputsWithProjectPath = {
      projectPath: projectPath,
      platform: Platform.VSCode,
      language: "typescript",
      "app-name": appName,
    };
    const component = Container.get(ComponentNames.TeamsApi) as any;
    const addApiRes = await component.add(context, inputs);
    if (addApiRes.isErr()) {
      console.log(addApiRes.error);
    }
    assert.isTrue(addApiRes.isOk());

    const teamsApi = getComponent(context.projectSetting, ComponentNames.TeamsApi);
    assert.exists(teamsApi);
    assert.equal(teamsApi?.hosting, ComponentNames.Function);
    assert.equal(teamsApi?.folder, "api");
    assert.isTrue(teamsApi?.build);
    const azureFunction = getComponent(context.projectSetting, ComponentNames.Function);
    assert.exists(azureFunction?.connections);
    if (azureFunction?.connections) {
      assert.include(azureFunction.connections, ComponentNames.TeamsApi);
    }
  });

  it("add api twice", async () => {
    sandbox.stub(bicepUtils, "persistBiceps").rejects();
    const inputs: InputsWithProjectPath = {
      projectPath: projectPath,
      platform: Platform.VSCode,
      language: "typescript",
      "app-name": appName,
    };
    const component = Container.get(ComponentNames.TeamsApi) as any;
    const addApiRes = await component.add(context, inputs);
    if (addApiRes.isErr()) {
      console.log(addApiRes.error);
    }
    assert.isTrue(addApiRes.isOk());
    const teamsApi = context.projectSetting.components.filter(
      (component) => component.name === ComponentNames.TeamsApi
    );
    assert.equal(teamsApi.length, 1);
    assert.equal(teamsApi[0].functionNames.length, 2);
    const azureFunction = context.projectSetting.components.filter(
      (component) => component.name === ComponentNames.Function
    );
    assert.equal(azureFunction.length, 1);
  });
  it("api build ts", async () => {
    context.projectSetting.programmingLanguage = ProgrammingLanguage.TS;
    context.projectSetting.components.push({
      name: ComponentNames.TeamsApi,
      folder: "api",
    });
    const component = Container.get(ComponentNames.TeamsApi) as any;
    sandbox.stub(DepsManager.prototype, "getStatus").resolves([{ command: "" } as any]);
    sandbox.stub(funcDepsHelper, "installFuncExtension").resolves();
    const execStub = sandbox.stub(child_process, "exec").yields();
    sandbox.stub(ApiCodeProvider.prototype, <any>"handleDotnetChecker").resolves();
    const inputs: InputsWithProjectPath = {
      projectPath: projectPath,
      platform: Platform.VSCode,
    };
    const res = await component.build(context, inputs);
    assert.isTrue(res.isOk());
    assert.isTrue(execStub.calledTwice); // Exec `npm install` & `npm run build`
  });
  it("api build js", async () => {
    context.projectSetting.programmingLanguage = ProgrammingLanguage.JS;
    context.projectSetting.components.push({
      name: ComponentNames.TeamsApi,
      folder: "api",
    });
    const component = Container.get(ComponentNames.TeamsApi) as any;
    const execStub = sandbox.stub(child_process, "exec").yields();
    sandbox.stub(ApiCodeProvider.prototype, <any>"handleDotnetChecker").resolves();
    sandbox.stub(DepsManager.prototype, "getStatus").resolves([{ command: "" } as any]);
    sandbox.stub(funcDepsHelper, "installFuncExtension").resolves();
    const inputs: InputsWithProjectPath = {
      projectPath: projectPath,
      platform: Platform.VSCode,
    };
    const res = await component.build(context, inputs);
    assert.isTrue(res.isOk());
    assert.isTrue(execStub.calledOnce); // Exec `npm install`
  });
});
