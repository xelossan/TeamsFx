# Enable single sign-on for bot applications

Microsoft Teams provides a mechanism by which an application can obtain the signed-in Teams user token to access Microsoft Graph (and other APIs). Teams Toolkit facilitates this interaction by abstracting some of the Azure Active Directory (AAD) flows and integrations behind some simple, high level APIs. This enables you to add single sign-on (SSO) features easily to your Teams application.

For a bot application, user can invoke the AAD consent flow to obtain sso token to call Graph and other APIs. 

# Changes to your project

When you added the SSO feature to your application, Teams Toolkit updated your project to support SSO:

After you successfully added SSO into your project, Teams Toolkit will create and modify some files that helps you implement SSO feature.

| Action | File | Description |
| - | - | - |
| Modify | `azureWebAppBotConfig.bicep` under `templates/azure/teamsFx` and `azure.parameters.dev.json` under `.fx/configs`| Insert environment variables used for bot web app to enable SSO feature |
| Modify | `manifest.template.json` under `templates/appPackage` | An `webApplicationInfo` object will be added into your Teams app manifest template. This field is required by Teams when enabling SSO. |
| Modify | `projectSettings.json` under `.fx/configs` | Add bot sso capability, which will be used internally by Teams Toolkit. |
| Create| `aad.template.json` under `templates/appPackage` | The Azure Active Directory application manifest that is used to register the application with AAD. |
| Create | `auth/bot` | Reference code, redirect pages and a `README.md` file. These files are provided for reference. See below for more information. |

# Update your code to add SSO

As described above, the Teams Toolkit generated some configuration to set up your application for SSO, but you need to update your application business logic to take advantage of the SSO feature as appropriate.

> Note: The following part is for `command and response bot`. For `basic bot`, please refer to the [bot-sso sample](https://aka.ms/bot-sso-sample).

## Set up the AAD redirects

1. Move the `auth/bot/public` folder to `bot/src`. This folder contains HTML pages that the bot application hosts. When single sign-on flows are initiated with AAD, AAD will redirect the user to these pages.
1. Modify your `bot/src/index` to add the appropriate `restify` routes to these pages.

    ```ts
    const path = require("path");

    server.get(
        "/auth-*.html",
        restify.plugins.serveStatic({
            directory: path.join(__dirname, "public"),
        })
    );
    ```

## Update your business logic

The sample business logic provides a sso command handler `ProfileSsoCommandHandler` that use an AAD token to call Microsoft Graph. This token is obtained by using the logged-in Teams user token. The flow is brought together in a dialog that will display a consent dialog if required.

To make this work in your application:


1. Move `profileSsoCommandHandler` file under `auth/bot/sso` folder to `bot/src`. ProfileSsoCommandHandler class is a sso command handler to get user info with SSO token. You can follow this method and create your own sso command handler.

1. Open `package.json` file, make sure that teamfx SDK version >= 1.2.0
1. Execute the following commands under `bot` folder: `npm install isomorphic-fetch --save`
1. (For ts only) Execute the following commands under `bot` folder: `npm install copyfiles --save-dev` and replace following line in package.json:

    ```json
    "build": "tsc --build && shx cp -r ./src/adaptiveCards ./lib/src",
    ```

    with:

    ```json
    "build": "tsc --build && shx cp -r ./src/adaptiveCards ./lib/src && copyfiles src/public/*.html lib/",
    ```
    By doing this, the HTML pages used for auth redirect will be copied when building this bot project.

1. After adding the following files, you need to update `bot/src/index` file.
Please replace the following code to make sso consent flow works:

    ```ts
    server.post("/api/messages", async (req, res) => {
        await commandBot.requestHandler(req, res);
    });
    ```

    with:

    ```ts
    server.post("/api/messages", async (req, res) => {
        await commandBot.requestHandler(req, res).catch((err) => {
            // Error message including "412" means it is waiting for user's consent, which is a normal process of SSO, sholdn't throw this error.
            if (!err.message.includes("412")) {
                throw err;
            }
        });
    });
    ```

1. Replace the options for `ConversationBot` instance in `bot/src/internal/initialize` to add the sso config and sso command handler:

    ```ts
    export const commandBot = new ConversationBot({
        ...
        command: {
            enabled: true,
            commands: [new HelloWorldCommandHandler()],
        },
    });
    ```

    with:

    ```ts
    import { ProfileSsoCommandHandler } from "../profileSsoCommandHandler";

    export const commandBot = new ConversationBot({
        ...
        // To learn more about ssoConfig, please refer teamsfx sdk document: https://docs.microsoft.com/microsoftteams/platform/toolkit/teamsfx-sdk
        ssoConfig: {
            aad :{
                scopes:["User.Read"],
            },
        },
        command: {
            enabled: true,
            commands: [new HelloWorldCommandHandler() ],
            ssoCommands: [new ProfileSsoCommandHandler()],
        },
    });
    ```

1. Register your command in the Teams app manifest. Open `templates/appPackage/manifest.template.json`, and add following lines under `commands` in `commandLists` of your bot:

    ```json
    {
        "title": "profile",
        "description": "Show user profile using Single Sign On feature"
    }
    ```

## (Optional) Add a new sso command to the bot

After successfully add SSO in your project, you can also add a new sso command.

1. Create a new file (e.g. `photoSsoCommandHandler.ts` or `photoSsoCommandHandler.js`) under `bot/src/` and add your own business logic to call Graph API:

    ```TypeScript
    // for TypeScript:
    import { Activity, TurnContext, ActivityTypes } from "botbuilder";
    import "isomorphic-fetch";
    import {
        CommandMessage,
        TriggerPatterns,
        TeamsFx,
        createMicrosoftGraphClient,
        TeamsFxBotSsoCommandHandler,
        TeamsBotSsoPromptTokenResponse,
    } from "@microsoft/teamsfx";

    export class PhotoSsoCommandHandler implements TeamsFxBotSsoCommandHandler {
        triggerPatterns: TriggerPatterns = "photo";

        async handleCommandReceived(
            context: TurnContext,
            message: CommandMessage,
            tokenResponse: TeamsBotSsoPromptTokenResponse,
        ): Promise<string | Partial<Activity> | void> {
            await context.sendActivity("Retrieving user information from Microsoft Graph ...");

            const teamsfx = new TeamsFx().setSsoToken(tokenResponse.ssoToken);

            const graphClient = createMicrosoftGraphClient(teamsfx, ["User.Read"]);

            let photoUrl = "";
            try {
                const photo = await graphClient.api("/me/photo/$value").get();
                const arrayBuffer = await photo.arrayBuffer();
                const buffer=Buffer.from(arrayBuffer, 'binary');
                photoUrl = "data:image/png;base64," + buffer.toString("base64");
            } catch {
                // Could not fetch photo from user's profile, return empty string as placeholder.
            }
            if (photoUrl) {
                const photoMessage: Partial<Activity> = {
                    type: ActivityTypes.Message, 
                    text: 'This is your photo:', 
                    attachments: [
                        {
                            name: 'photo.png',
                            contentType: 'image/png',
                            contentUrl: photoUrl
                        }
                    ]
                };
                return photoMessage;
            } else {
                return "Could not retrieve your photo from Microsoft Graph. Please make sure you have uploaded your photo.";
            }
        }
    }
    ```

    ```javascript
    // for JavaScript:
    const { ActivityTypes } = require("botbuilder");
    require("isomorphic-fetch");
    const { createMicrosoftGraphClient, TeamsFx } = require("@microsoft/teamsfx");

    class PhotoSsoCommandHandler {
        triggerPatterns = "photo";

        async handleCommandReceived(context, message, tokenResponse) {
            await context.sendActivity("Retrieving user information from Microsoft Graph ...");

            const teamsfx = new TeamsFx().setSsoToken(tokenResponse.ssoToken);

            const graphClient = createMicrosoftGraphClient(teamsfx, ["User.Read"]);
        
            let photoUrl = "";
            try {
                const photo = await graphClient.api("/me/photo/$value").get();
                const arrayBuffer = await photo.arrayBuffer();
                const buffer=Buffer.from(arrayBuffer, 'binary');
                photoUrl = "data:image/png;base64," + buffer.toString("base64");
            } catch {
            // Could not fetch photo from user's profile, return empty string as placeholder.
            }
            if (photoUrl) {
                const photoMessage = {
                    type: ActivityTypes.Message, 
                    text: 'This is your photo:', 
                    attachments: [
                        {
                            name: 'photo.png',
                            contentType: 'image/png',
                            contentUrl: photoUrl
                        }
                    ]
                };
                return photoMessage;
            } else {
                return "Could not retrieve your photo from Microsoft Graph. Please make sure you have uploaded your photo.";
            }
        }
    }

    module.exports = {
        PhotoSsoCommandHandler,
    };

    ```

1. Put `PhotoSsoCommandHandler` instance to `ssoCommands` array in `bot/src/internal/initialize.ts` as below:
    
    ```ts
    // for TypeScript:
    import { PhotoSsoCommandHandler } from "../photoSsoCommandHandler";

    export const commandBot = new ConversationBot({
        ...
        command: {
            ...
            ssoCommands: [new ProfileSsoCommandHandler(), new PhotoSsoCommandHandler()],
        },
    });
    ```

    ```javascript
    // for JavaScript:
    ...
    const { PhotoSsoCommandHandler } = require("../photoSsoCommandHandler");

    const commandBot = new ConversationBot({
        ...
        command: {
            ...
            ssoCommands: [new ProfileSsoCommandHandler(), new PhotoSsoCommandHandler()]
        },
    });
    ...

    ```

1. Register your command in the Teams app manifest. Open 'templates/appPackage/manifest.template.json', and add following lines under `commands` in `commandLists` of your bot:

    ```json
    {
        "title": "photo",
        "description": "Show user photo using Single Sign On feature"
    }
    ```

# Debug your application

You can debug your application by pressing F5.

Teams Toolkit will use the AAD manifest file to register a AAD application registered for SSO.

To learn more about Teams Toolkit local debug functionalities, refer to this [document](https://docs.microsoft.com/microsoftteams/platform/toolkit/debug-local).

# Customize AAD applications

The AAD [manifest](https://docs.microsoft.com/azure/active-directory/develop/reference-app-manifest) allows you to customize various aspects of your application registration. You can update the manifest as needed.

Follow this [document](https://aka.ms/teamsfx-aad-manifest#customize-aad-manifest-template) if you need to include additional API permissions to access your desired APIs.

Follow this [document](https://aka.ms/teamsfx-aad-manifest#How-to-view-the-AAD-app-on-the-Azure-portal) to view your AAD application in Azure Portal.

# Trouble Shooting

## Login page does not pop up after clicking `continue`

First check whether your auth-start page is available by directly go to "{your-bot-endpoint}/auth-start.html" in your browser. You can find your-bot-endpoint in `.fx/states/state.{env}.json`.

  - If the auth-start page can be opened in your browser, please try sign out current account in Teams app page and sign in again and run the command again.
  - If encounter with ngrok page below when local debug, please follow the steps to solve this issue.
  
    1. Stop debugging in Visual Studio Code.
    1. Sign up an ngrok account in https://dashboard.ngrok.com/signup.
    1. Copy your personal ngrok authtoken from https://dashboard.ngrok.com/get-started/your-authtoken.
    1. Run `npx ngrok authtoken <your-personal-ngrok-authtoken>` in Visual Studio Code terminal.
    1. Start debugging the project again by hitting the F5 key in Visual Studio Code.

    ![ngrok auth page](https://user-images.githubusercontent.com/63089166/190566043-6957edc9-c5b8-409d-b532-979ee0ef6ce5.png)