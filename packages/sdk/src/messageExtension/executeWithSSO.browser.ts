// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import { TurnContext, MessagingExtensionResponse } from "botbuilder";
import { AuthenticationConfiguration } from "../models/configuration";
import { MessageExtensionTokenResponse } from "./teamsMsgExtTokenResponse";
import { ErrorWithCode, ErrorMessage, ErrorCode } from "../core/errors";
import { formatString } from "../util/utils";

/**
 * Users execute query with SSO or Access Token.
 * @remarks
 * Only works in in server side.
 */
export async function handleMessageExtensionQueryWithToken(
  context: TurnContext,
  config: AuthenticationConfiguration,
  scopes: string | string[],
  logic: (token: MessageExtensionTokenResponse) => Promise<any>
): Promise<MessagingExtensionResponse | void> {
  throw new ErrorWithCode(
    formatString(ErrorMessage.BrowserRuntimeNotSupported, "queryWithToken in message extension"),
    ErrorCode.RuntimeNotSupported
  );
}
