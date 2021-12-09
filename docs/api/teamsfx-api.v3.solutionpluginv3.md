<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@microsoft/teamsfx-api](./teamsfx-api.md) &gt; [v3](./teamsfx-api.v3.md) &gt; [SolutionPluginV3](./teamsfx-api.v3.solutionpluginv3.md)

## v3.SolutionPluginV3 type

<b>Signature:</b>

```typescript
export declare type SolutionPluginV3 = StrictOmit<v2.SolutionPlugin, "getQuestions"> & {
    addResource: (ctx: Context, localSettings: Json, inputs: InputsWithProjectPath & {
        module?: keyof Module;
    }) => Promise<Result<Void, FxError>>;
    addCapability: (ctx: Context, localSettings: Json, inputs: InputsWithProjectPath) => Promise<Result<Void, FxError>>;
    getQuestionsForAddResource?: (ctx: Context, inputs: Inputs) => Promise<Result<QTreeNode | undefined, FxError>>;
    getQuestionsForLocalProvision?: (ctx: Context, inputs: Inputs, localSettings: DeepReadonly<Json>, tokenProvider: TokenProvider) => Promise<Result<QTreeNode | undefined, FxError>>;
    getQuestionsForProvision?: (ctx: Context, inputs: Inputs, envInfo: DeepReadonly<EnvInfoV3>, tokenProvider: TokenProvider) => Promise<Result<QTreeNode | undefined, FxError>>;
    getQuestionsForDeploy?: (ctx: Context, inputs: Inputs, envInfo: DeepReadonly<EnvInfoV3>, tokenProvider: TokenProvider) => Promise<Result<QTreeNode | undefined, FxError>>;
    provisionResource?: (ctx: Context, inputs: InputsWithProjectPath, envInfo: EnvInfoV3, tokenProvider: TokenProvider) => Promise<Result<Void, FxError>>;
};
```
<b>References:</b> [Context](./teamsfx-api.context.md)<!-- -->, [Json](./teamsfx-api.json.md)<!-- -->, [Void](./teamsfx-api.void.md)<!-- -->, [FxError](./teamsfx-api.fxerror.md)<!-- -->, [Inputs](./teamsfx-api.inputs.md)<!-- -->, [QTreeNode](./teamsfx-api.qtreenode.md)<!-- -->, [TokenProvider](./teamsfx-api.tokenprovider.md)
