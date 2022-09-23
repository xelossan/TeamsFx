// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { hooks } from "@feathersjs/hooks/lib";
import {
  ActionContext,
  Bicep,
  CloudResource,
  ContextV3,
  Effect,
  err,
  FxError,
  InputsWithProjectPath,
  ok,
  ResourceContextV3,
  Result,
  v3,
} from "@microsoft/teamsfx-api";
import { assign, cloneDeep, merge } from "lodash";
import "reflect-metadata";
import { Container, Service } from "typedi";
import { TelemetryEvent, TelemetryProperty } from "../../../common/telemetry";
import { convertToAlphanumericOnly } from "../../../common/utils";
import { globalVars } from "../../../core/globalVars";
import { CoreQuestionNames } from "../../../core/question";
import { BotCapabilities, QuestionNames, TemplateProjectsScenarios } from "./constants";
import {
  AppServiceOptionItem,
  AppServiceOptionItemForVS,
  FunctionsHttpAndTimerTriggerOptionItem,
  FunctionsHttpTriggerOptionItem,
  FunctionsTimerTriggerOptionItem,
} from "./question";
import {
  BotOptionItem,
  CommandAndResponseOptionItem,
  M365SearchAppOptionItem,
  MessageExtensionItem,
  NotificationOptionItem,
  WorkflowOptionItem,
} from "../../../plugins/solution/fx-solution/question";
import { BicepComponent } from "../../bicep";
import { BotCodeProvider } from "../../code/botCode";
import "../../connection/azureWebAppConfig";
import { ComponentNames, PathConstants, ProgrammingLanguage, Scenarios } from "../../constants";
import { generateLocalDebugSettings } from "../../debug";
import { Plans } from "../../messages";
import { ActionExecutionMW } from "../../middleware/actionExecutionMW";
import { AppManifest } from "../../resource/appManifest/appManifest";
import "../../resource/azureAppService/azureWebApp";
import { BotService } from "../../resource/botService/botService";
import { IdentityResource } from "../../resource/identity";
import {
  generateConfigBiceps,
  bicepUtils,
  addFeatureNotify,
  scaffoldRootReadme,
} from "../../utils";
import { getComponent, getComponentByScenario } from "../../workflow";
@Service(ComponentNames.TeamsBot)
export class TeamsBot {
  name = ComponentNames.TeamsBot;
  @hooks([
    ActionExecutionMW({
      enableTelemetry: true,
      telemetryEventName: TelemetryEvent.AddFeature,
      telemetryComponentName: ComponentNames.TeamsBot,
      errorSource: "BT",
      errorHandler: (error) => {
        if (error && !error?.name) {
          error.name = "addBotError";
        }
        return error as FxError;
      },
    }),
  ])
  async add(
    context: ContextV3,
    inputs: InputsWithProjectPath,
    actionContext?: ActionContext
  ): Promise<Result<undefined, FxError>> {
    const projectSettings = context.projectSetting;
    const effects: Effect[] = [];
    const botCapability = featureToCapability.get(inputs[CoreQuestionNames.Features] as string);
    inputs.hosting = resolveHosting(inputs);
    inputs[CoreQuestionNames.ProgrammingLanguage] =
      context.projectSetting.programmingLanguage ||
      inputs[CoreQuestionNames.ProgrammingLanguage] ||
      "javascript";
    globalVars.isVS = inputs[CoreQuestionNames.ProgrammingLanguage] === "csharp";
    const isM365 = context.projectSetting.isM365 === true;
    let botConfig = getComponent(projectSettings, ComponentNames.TeamsBot);
    // bot can only add once
    if (botConfig) {
      if (!botConfig.capabilities?.includes(botCapability)) {
        botConfig.capabilities.push(botCapability);
        const res = await this.addBotCapability(inputs, isM365);
        if (res.isErr()) return err(res.error);
        effects.push("add bot capability in app manifest");
      }
      return ok(undefined);
    }
    const addedComponents: string[] = [];

    // 1. scaffold bot and add bot config
    {
      const clonedInputs = cloneDeep(inputs);
      const scenarios = featureToScenario.get(inputs[CoreQuestionNames.Features])?.(
        inputs[QuestionNames.BOT_HOST_TYPE_TRIGGER]
      );
      const language =
        inputs?.[CoreQuestionNames.ProgrammingLanguage] ||
        context.projectSetting.programmingLanguage ||
        ProgrammingLanguage.JS;
      const folder = language === ProgrammingLanguage.CSharp ? "." : PathConstants.botWorkingDir;
      assign(clonedInputs, {
        folder: folder,
        scenarios: scenarios,
        language: language,
      });
      const botCode = Container.get<BotCodeProvider>(ComponentNames.BotCode);
      const res = await botCode.generate(context, clonedInputs);
      if (res.isErr()) return err(res.error);
      effects.push("generate bot code");
      botConfig = {
        name: ComponentNames.TeamsBot,
        hosting: inputs.hosting,
        provision: language === ProgrammingLanguage.CSharp,
        deploy: true,
        capabilities: botCapability ? [botCapability] : [],
        build: true,
        folder: folder,
      };
      projectSettings.components.push(botConfig);
      addedComponents.push(botConfig.name);
      effects.push(Plans.generateSourceCodeAndConfig(ComponentNames.TeamsBot));
    }

    // 2. generate provision bicep
    // 2.0 bicep.init
    {
      const bicepComponent = Container.get<BicepComponent>("bicep");
      const res = await bicepComponent.init(inputs.projectPath);
      if (res.isErr()) return err(res.error);
    }

    const biceps: Bicep[] = [];
    // 2.1 bot-service bicep
    if (!getComponent(projectSettings, ComponentNames.BotService)) {
      const clonedInputs = cloneDeep(inputs);
      assign(clonedInputs, {
        hosting: inputs.hosting,
        scenario: Scenarios.Bot,
      });
      const botService = Container.get<BotService>(ComponentNames.BotService);
      const res = await botService.generateBicep(context, clonedInputs);
      if (res.isErr()) return err(res.error);
      res.value.forEach((b) => biceps.push(b));
      projectSettings.components.push({
        name: ComponentNames.BotService,
        provision: true,
      });
      addedComponents.push(ComponentNames.BotService);
      effects.push(Plans.generateBicepAndConfig(ComponentNames.BotService));
    }

    // 2.2 hosting bicep
    const hostingConfig = getComponentByScenario(projectSettings, inputs.hosting, Scenarios.Bot);
    if (!hostingConfig) {
      const clonedInputs = cloneDeep(inputs);
      assign(clonedInputs, {
        componentId: ComponentNames.TeamsBot,
        scenario: Scenarios.Bot,
      });
      const hostingComponent = Container.get<CloudResource>(inputs.hosting);
      const res = await hostingComponent.generateBicep!(context, clonedInputs);
      if (res.isErr()) return err(res.error);
      res.value.forEach((b) => biceps.push(b));
      projectSettings.components.push({
        name: inputs.hosting,
        scenario: Scenarios.Bot,
      });
      addedComponents.push(inputs.hosting);
      effects.push(Plans.generateBicepAndConfig(inputs.hosting));
    }

    // 2.3 identity bicep
    if (!getComponent(projectSettings, ComponentNames.Identity)) {
      const clonedInputs = cloneDeep(inputs);
      const identityComponent = Container.get<IdentityResource>(ComponentNames.Identity);
      const res = await identityComponent.generateBicep(context, clonedInputs);
      if (res.isErr()) return err(res.error);
      res.value.forEach((b) => biceps.push(b));
      projectSettings.components.push({
        name: ComponentNames.Identity,
        provision: true,
      });
      addedComponents.push(ComponentNames.Identity);
      effects.push(Plans.generateBicepAndConfig(ComponentNames.Identity));
    }
    //persist bicep
    const bicepRes = await bicepUtils.persistBiceps(
      inputs.projectPath,
      convertToAlphanumericOnly(context.projectSetting.appName),
      biceps
    );
    if (bicepRes.isErr()) return bicepRes;
    // 3. generate config bicep
    {
      const res = await generateConfigBiceps(context, inputs);
      if (res.isErr()) return err(res.error);
      effects.push("generate config biceps");
    }

    // 4. local debug settings
    {
      const res = await generateLocalDebugSettings(context, inputs);
      if (res.isErr()) return err(res.error);
      effects.push("generate local debug configs");
    }

    // 5. app-manifest.addCapability
    {
      const res = await this.addBotCapability(inputs, isM365);
      if (res.isErr()) return err(res.error);
      effects.push("add bot capability in app manifest");
    }

    projectSettings.programmingLanguage ||= inputs[CoreQuestionNames.ProgrammingLanguage];
    merge(actionContext?.telemetryProps, {
      [TelemetryProperty.Components]: JSON.stringify(addedComponents),
    });
    await scaffoldRootReadme(context.projectSetting, inputs.projectPath);
    addFeatureNotify(inputs, context.userInteraction, "Capability", [inputs.features]);
    return ok(undefined);
  }
  async configure(
    context: ResourceContextV3,
    inputs: InputsWithProjectPath
  ): Promise<Result<undefined, FxError>> {
    const botCode = Container.get<BotCodeProvider>(ComponentNames.BotCode);
    return await botCode.configure(context, inputs);
  }
  async build(
    context: ResourceContextV3,
    inputs: InputsWithProjectPath
  ): Promise<Result<undefined, FxError>> {
    const botCode = Container.get<BotCodeProvider>(ComponentNames.BotCode);
    const res = await botCode.build(context, inputs);
    if (res.isErr()) return err(res.error);
    return ok(undefined);
  }
  private async addBotCapability(
    inputs: InputsWithProjectPath,
    isM365 = false
  ): Promise<Result<undefined, FxError>> {
    {
      const manifestCapability: v3.ManifestCapability = {
        name:
          inputs[CoreQuestionNames.Features] === MessageExtensionItem.id ||
          inputs[CoreQuestionNames.Features] === M365SearchAppOptionItem.id
            ? "MessageExtension"
            : "Bot",
      };
      const clonedInputs = {
        ...cloneDeep(inputs),
        validDomain: `{{state.${ComponentNames.TeamsBot}.domain}}`,
      };
      const appManifest = Container.get<AppManifest>(ComponentNames.AppManifest);
      return await appManifest.addCapability(clonedInputs, [manifestCapability], isM365);
    }
  }
}

/**
 *
 *   capability = Notification
 *     bot-host-type-trigger = http-restify
 *       group=bot, scenario=notification-restify, host=app-service
 *     bot-host-type-trigger = [http-functions, timer-functions]
 *       group=bot, host=function, scenario=notification-function-base + [notification-trigger-http, notification-trigger-timer]
 *   capability = command-bot:
 *     group=bot, host=app-service, scenario=command-and-response
 *   capability = workflow-bot:
 *     group=bot, host=app-service, scenario=workflow
 *   capability = Bot
 *     group=bot, host=app-service, scenario=default
 *   capability = MessagingExtension
 *     group=bot, host=app-service, scenario=default
 */
const featureToCapability: Map<string, string> = new Map([
  [BotOptionItem.id, BotCapabilities.BOT],
  [MessageExtensionItem.id, BotCapabilities.MESSAGE_EXTENSION],
  [M365SearchAppOptionItem.id, BotCapabilities.M365_SEARCH_APP],
  [CommandAndResponseOptionItem.id, BotCapabilities.COMMAND_AND_RESPONSE],
  [NotificationOptionItem.id, BotCapabilities.NOTIFICATION],
  [WorkflowOptionItem.id, BotCapabilities.WORKFLOW],
]);

const featureToScenario: Map<string, (triggers?: string) => TemplateProjectsScenarios[]> = new Map([
  [BotOptionItem.id, () => [TemplateProjectsScenarios.DEFAULT_SCENARIO_NAME]],
  [NotificationOptionItem.id, (triggers?: string) => resolveNotificationScenario(triggers)],
  [
    CommandAndResponseOptionItem.id,
    () => [TemplateProjectsScenarios.COMMAND_AND_RESPONSE_SCENARIO_NAME],
  ],
  [WorkflowOptionItem.id, () => [TemplateProjectsScenarios.WORKFLOW_SCENARIO_NAME]],
  [MessageExtensionItem.id, () => [TemplateProjectsScenarios.DEFAULT_SCENARIO_NAME]],
  [M365SearchAppOptionItem.id, () => [TemplateProjectsScenarios.M365_SCENARIO_NAME]],
]);

const triggersToScenarios: Map<string, TemplateProjectsScenarios[]> = new Map([
  [AppServiceOptionItem.id, [TemplateProjectsScenarios.NOTIFICATION_RESTIFY_SCENARIO_NAME]],
  [AppServiceOptionItemForVS.id, [TemplateProjectsScenarios.NOTIFICATION_WEBAPI_SCENARIO_NAME]],
  [
    FunctionsHttpTriggerOptionItem.id,
    [
      TemplateProjectsScenarios.NOTIFICATION_FUNCTION_BASE_SCENARIO_NAME,
      TemplateProjectsScenarios.NOTIFICATION_FUNCTION_TRIGGER_HTTP_SCENARIO_NAME,
    ],
  ],
  [
    FunctionsTimerTriggerOptionItem.id,
    [
      TemplateProjectsScenarios.NOTIFICATION_FUNCTION_BASE_SCENARIO_NAME,
      TemplateProjectsScenarios.NOTIFICATION_FUNCTION_TRIGGER_TIMER_SCENARIO_NAME,
    ],
  ],
  [
    FunctionsHttpAndTimerTriggerOptionItem.id,
    [
      TemplateProjectsScenarios.NOTIFICATION_FUNCTION_BASE_SCENARIO_NAME,
      TemplateProjectsScenarios.NOTIFICATION_FUNCTION_TRIGGER_HTTP_SCENARIO_NAME,
      TemplateProjectsScenarios.NOTIFICATION_FUNCTION_TRIGGER_TIMER_SCENARIO_NAME,
    ],
  ],
]);

const resolveNotificationScenario = (triggers?: string): TemplateProjectsScenarios[] => {
  if (typeof triggers !== "string") {
    return [];
  }
  return triggersToScenarios.get(triggers) || [];
};

const resolveHosting: (inputs: InputsWithProjectPath) => string = (inputs): string => {
  let hosting = "azure-web-app";
  const triggers = inputs[QuestionNames.BOT_HOST_TYPE_TRIGGER] as string[];
  if (
    triggers?.includes(FunctionsHttpTriggerOptionItem.id) ||
    triggers?.includes(FunctionsTimerTriggerOptionItem.id) ||
    triggers?.includes(FunctionsHttpAndTimerTriggerOptionItem.id)
  ) {
    hosting = "azure-function";
  }
  return hosting;
};
