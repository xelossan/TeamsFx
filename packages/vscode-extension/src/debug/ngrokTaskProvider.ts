/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from "vscode";
import * as cp from "child_process";
import { v4 as uuidv4 } from "uuid";

const ControlCodes = {
  CtrlC: "\u0003",
};

//https://github.com/microsoft/vscode-tye/blob/main/src/tasks/taskPseudoterminal.ts
export class NgrokTaskTerminal implements vscode.Pseudoterminal {
  private static ngrokTaskTerminals: Map<string, NgrokTaskTerminal> = new Map<
    string,
    NgrokTaskTerminal
  >();
  private static endpoints: Map<string, string> = new Map<string, string>();
  private writeEmitter = new vscode.EventEmitter<string>();
  onDidWrite: vscode.Event<string> = this.writeEmitter.event;
  private closeEmitter = new vscode.EventEmitter<number>();
  onDidClose?: vscode.Event<number> = this.closeEmitter.event;
  private childProc: cp.ChildProcess | undefined;
  private id: string;

  constructor(taskDefinition: vscode.TaskDefinition) {
    const args = taskDefinition.args;
    const env = process.env;
    this.id = uuidv4();
    for (const [id, taskTerminal] of NgrokTaskTerminal.ngrokTaskTerminals) {
      taskTerminal.close();
    }
    NgrokTaskTerminal.ngrokTaskTerminals.set(this.id, this);
  }

  open(initialDimensions: vscode.TerminalDimensions | undefined): void {
    this.startNgrok().catch(() => this.closeWithNumber(0));
  }

  close(): void {
    // The terminal has been closed. Shutdown the build.
    this.closeWithNumber(0);
  }

  handleInput(data: string): void {
    this.writeEmitter.fire(data === "\r" ? "\r\n" : data);
    if (data.includes(ControlCodes.CtrlC)) {
      this.closeWithNumber(0);
    }
  }

  private closeWithNumber(exitCode: number) {
    NgrokTaskTerminal.endpoints.delete(this.id);
    this.childProc?.kill();
    this.writeEmitter.fire("Local tunnel is closed .\r\n");
    NgrokTaskTerminal.ngrokTaskTerminals.delete(this.id);
    this.closeEmitter.fire(0);
  }

  private parseNgrokEndpoint(data: string): { src: string; dist: string } | undefined {
    const matches = data.match(/obj=tunnels name=bot addr=(?<src>.*) url=(?<endpoint>.*)/);
    if (matches && matches?.length > 2) {
      return { src: matches[1], dist: matches[2] };
    }
    return undefined;
  }

  private async startNgrok(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.writeEmitter.fire(`Starting local tunnel ${this.id}\r\n`);

      const command = "ngrok start bot --config=./.fx/ngrok.yml --log=stdout --log-format=logfmt";
      const options: cp.SpawnOptions = {
        cwd: vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath,
        shell: true,
      };

      this.childProc = cp.spawn(command, [], options);

      // timeout only exists for exec not spawn
      setTimeout(() => {
        reject(new Error(`Execute timeout, ${100000} ms`));
      }, 100000);

      this.childProc.stdout?.setEncoding("utf-8");
      this.childProc.stdout?.on("data", (data: string | Buffer) => {
        const line = data.toString().replace(/\n/g, "\r\n");
        this.writeEmitter.fire(line);

        this.parseNgrokEndpoint(line);
      });

      this.childProc.stderr?.setEncoding("utf-8");
      this.childProc.stderr?.on("data", (data: string | Buffer) => {
        const line = data.toString().replace(/\n/g, "\r\n");
        this.writeEmitter.fire(line);
      });

      this.childProc.on("error", (error) => {
        reject(error);
      });
      this.childProc.on("close", (code: number) => {
        resolve();
      });
    });
  }
}
