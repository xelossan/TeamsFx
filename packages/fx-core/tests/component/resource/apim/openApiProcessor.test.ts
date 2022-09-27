// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import "mocha";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import path from "path";
import { OpenApiProcessor } from "../../../../src/component/resource/apim/utils/openApiProcessor";
import {
  EmptyTitleInOpenApiDocument,
  EmptyVersionInOpenApiDocument,
  InvalidFunctionEndpoint,
  InvalidOpenApiDocument,
} from "../../../../src/component/resource/apim/error";
import { OpenApiSchemaVersion } from "../../../../src/component/resource/apim/constants";
chai.use(chaiAsPromised);

const testDataBaseFolder = "./tests/component/resource/apim/data/openApiProcessor";
describe("OpenApiProcessor", () => {
  describe("#loadOpenApiDocument()", () => {
    const testInput: {
      message: string;
      filePath: string;
      schemaVersion: OpenApiSchemaVersion;
    }[] = [
      {
        message: "v3 json file",
        filePath: `${testDataBaseFolder}/openapi-user.json`,
        schemaVersion: OpenApiSchemaVersion.V3,
      },
      {
        message: "v3 yaml file",
        filePath: `${testDataBaseFolder}/openapi-user.yaml`,
        schemaVersion: OpenApiSchemaVersion.V3,
      },
      {
        message: "v2 json file",
        filePath: `${testDataBaseFolder}/swagger-user.json`,
        schemaVersion: OpenApiSchemaVersion.V2,
      },
      {
        message: "v2 yaml file",
        filePath: `${testDataBaseFolder}/swagger-user.yaml`,
        schemaVersion: OpenApiSchemaVersion.V2,
      },
    ];

    testInput.forEach((input) => {
      it(input.message, async () => {
        const openApiProcessor: OpenApiProcessor = new OpenApiProcessor();
        const result = await openApiProcessor.loadOpenApiDocument(input.filePath);
        chai.assert.equal("user input swagger", result.spec.info.title);
        chai.assert.equal("v1", result.spec.info.version);
        switch (input.schemaVersion) {
          case OpenApiSchemaVersion.V2:
            chai.assert.equal(OpenApiSchemaVersion.V2, result.schemaVersion);
            chai.assert.hasAllKeys(result.spec, ["paths", "definitions", "info", "swagger"]);
            break;
          case OpenApiSchemaVersion.V3:
            chai.assert.equal(OpenApiSchemaVersion.V3, result.schemaVersion);
            chai.assert.hasAllKeys(result.spec, ["paths", "components", "info", "openapi"]);
            break;
        }
      });
    });

    const errorInput: { message: string; filePath: string; error: [string, string] }[] = [
      {
        message: "invalid json file",
        filePath: `${testDataBaseFolder}/errorSpec/invalid.json`,
        error: InvalidOpenApiDocument.message(`${testDataBaseFolder}/errorSpec/invalid.json`),
      },
      {
        message: "invalid yaml file",
        filePath: `${testDataBaseFolder}/errorSpec/invalid.yaml`,
        error: InvalidOpenApiDocument.message(`${testDataBaseFolder}/errorSpec/invalid.yaml`),
      },
      {
        message: "info undefined",
        filePath: `${testDataBaseFolder}/errorSpec/info-undefined.json`,
        error: InvalidOpenApiDocument.message(
          `${testDataBaseFolder}/errorSpec/info-undefined.json`
        ),
      },
      {
        message: "not swagger file",
        filePath: `${testDataBaseFolder}/errorSpec/not-swagger.json`,
        error: InvalidOpenApiDocument.message(`${testDataBaseFolder}/errorSpec/not-swagger.json`),
      },
      {
        message: "title empty",
        filePath: `${testDataBaseFolder}/errorSpec/title-empty.json`,
        error: EmptyTitleInOpenApiDocument.message(
          `${testDataBaseFolder}/errorSpec/title-empty.json`
        ),
      },
      {
        message: "title undefined",
        filePath: `${testDataBaseFolder}/errorSpec/title-undefined.yaml`,
        error: InvalidOpenApiDocument.message(
          `${testDataBaseFolder}/errorSpec/title-undefined.yaml`
        ),
      },
      {
        message: "version empty",
        filePath: `${testDataBaseFolder}/errorSpec/version-empty.yaml`,
        error: EmptyVersionInOpenApiDocument.message(
          `${testDataBaseFolder}/errorSpec/version-empty.yaml`
        ),
      },
      {
        message: "version undefined",
        filePath: `${testDataBaseFolder}/errorSpec/version-undefined.json`,
        error: InvalidOpenApiDocument.message(
          `${testDataBaseFolder}/errorSpec/version-undefined.json`
        ),
      },
    ];
    errorInput.forEach((input) => {
      it(input.message, async () => {
        const openApiProcessor: OpenApiProcessor = new OpenApiProcessor();
        await chai
          .expect(openApiProcessor.loadOpenApiDocument(input.filePath))
          .to.be.rejectedWith(input.error[0]);
      });
    });
  });

  describe("#generateOpenApiDocument()", () => {
    const testInput: {
      message: string;
      schemaVersion: OpenApiSchemaVersion;
      endpoint: string;
      basePath?: string;
      expectedResult: { [key: string]: any };
    }[] = [
      {
        message: "v2 https://test-host/",
        schemaVersion: OpenApiSchemaVersion.V2,
        endpoint: "https://test-host/",
        expectedResult: {
          schemes: ["https"],
          host: "test-host",
          basePath: "/api",
        },
      },
      {
        message: "v2 http://test-host",
        schemaVersion: OpenApiSchemaVersion.V2,
        endpoint: "http://test-host",
        expectedResult: {
          schemes: ["http"],
          host: "test-host",
          basePath: "/api",
        },
      },
      {
        message: "v2 http://test-host with base path '/basepath'",
        schemaVersion: OpenApiSchemaVersion.V2,
        endpoint: "http://test-host",
        basePath: "/basepath",
        expectedResult: {
          schemes: ["http"],
          host: "test-host",
          basePath: "/basepath",
        },
      },
      {
        message: "v2 http://test-host with base path 'basepath'",
        schemaVersion: OpenApiSchemaVersion.V2,
        endpoint: "http://test-host",
        basePath: "basepath",
        expectedResult: {
          schemes: ["http"],
          host: "test-host",
          basePath: "/basepath",
        },
      },
      {
        message: "v3 https://test-host",
        schemaVersion: OpenApiSchemaVersion.V3,
        endpoint: "https://test-host",
        expectedResult: { servers: [{ url: "https://test-host/api" }] },
      },
      {
        message: "v3 https://test-host/",
        schemaVersion: OpenApiSchemaVersion.V3,
        endpoint: "https://test-host/",
        expectedResult: { servers: [{ url: "https://test-host/api" }] },
      },
      {
        message: "v3 https://test-host/ with base path '/basepath'",
        schemaVersion: OpenApiSchemaVersion.V3,
        endpoint: "https://test-host/",
        basePath: "/basepath",
        expectedResult: { servers: [{ url: "https://test-host/basepath" }] },
      },
      {
        message: "v3 https://test-host/ with base path 'basepath'",
        schemaVersion: OpenApiSchemaVersion.V3,
        endpoint: "https://test-host/",
        basePath: "basepath",
        expectedResult: { servers: [{ url: "https://test-host/basepath" }] },
      },
    ];

    testInput.forEach((input) => {
      it(`[valid endpoint] ${input.message}`, async () => {
        const openApiProcessor: OpenApiProcessor = new OpenApiProcessor();
        const openApiFile =
          input.schemaVersion == OpenApiSchemaVersion.V2
            ? `${testDataBaseFolder}/swagger-user.json`
            : `${testDataBaseFolder}/openapi-user.json`;
        const openApiDocument = await openApiProcessor.loadOpenApiDocument(openApiFile);
        const spec = openApiProcessor.patchOpenApiDocument(
          openApiDocument.spec,
          openApiDocument.schemaVersion,
          input.endpoint,
          input.basePath
        );
        for (const expectedKey in input.expectedResult) {
          chai.assert.deepEqual((spec as any)[expectedKey], input.expectedResult[expectedKey]);
        }
      });
    });

    const invalidInput: {
      message: string;
      schemaVersion: OpenApiSchemaVersion;
      endpoint: string;
      error: [string, string];
    }[] = [
      {
        message: "v2 test-host",
        schemaVersion: OpenApiSchemaVersion.V2,
        endpoint: "test-host",
        error: InvalidFunctionEndpoint.message(),
      },
      {
        message: "v3 test-host",
        schemaVersion: OpenApiSchemaVersion.V3,
        endpoint: "test-host",
        error: InvalidFunctionEndpoint.message(),
      },
      {
        message: "v2 ftp://test-host",
        schemaVersion: OpenApiSchemaVersion.V2,
        endpoint: "ftp://test-host",
        error: InvalidFunctionEndpoint.message(),
      },
      {
        message: "v3 ftp://test-host",
        schemaVersion: OpenApiSchemaVersion.V3,
        endpoint: "ftp://test-host",
        error: InvalidFunctionEndpoint.message(),
      },
    ];

    invalidInput.forEach((input) => {
      it(`[invalid endpoint] ${input.message}`, async () => {
        const openApiProcessor: OpenApiProcessor = new OpenApiProcessor();
        const openApiFile =
          input.schemaVersion == OpenApiSchemaVersion.V2
            ? `${testDataBaseFolder}/swagger-user.json`
            : `${testDataBaseFolder}/openapi-user.json`;
        const openApiDocument = await openApiProcessor.loadOpenApiDocument(openApiFile);
        chai
          .expect(() =>
            openApiProcessor.patchOpenApiDocument(
              openApiDocument.spec,
              openApiDocument.schemaVersion,
              input.endpoint
            )
          )
          .Throw(input.error[0]);
      });
    });
  });

  describe("#listOpenApiDocument()", () => {
    it("Load valid swagger files", async () => {
      const openApiProcessor: OpenApiProcessor = new OpenApiProcessor();
      const result = await openApiProcessor.listOpenApiDocument(
        `${testDataBaseFolder}/listOpenApiDocument`,
        ["exclude"],
        ["json", "yaml"]
      );

      chai.assert.deepEqual(
        [...result.keys()].sort(),
        [
          "openapi.json",
          "include/openapi.yaml",
          "include/swagger.json",
          "swagger.yaml",
          "include/deep/swagger.json",
        ].sort()
      );
    });
  });

  describe("#listAllFiles()", () => {
    let openApiProcessor: OpenApiProcessor;
    before(async () => {
      openApiProcessor = new OpenApiProcessor();
    });

    const testInput: {
      message: string;
      excludeFolders?: string[];
      fileExtensions?: string[];
      output: string[];
    }[] = [
      {
        message: "list all the files under folder",
        output: [
          "a/a1.json",
          "a/a2.txt",
          "a/a3",
          "a/a4.yaml",
          "b/b1.json",
          "b/b2.txt",
          "b/b3",
          "b/b4.yaml",
        ],
      },
      {
        message: "list the files not in folder 'a'",
        excludeFolders: ["a"],
        output: ["b/b1.json", "b/b2.txt", "b/b3", "b/b4.yaml"],
      },
      {
        message: "list the files not in folder 'a' & 'b'",
        excludeFolders: ["a", "b"],
        output: [],
      },
      {
        message: "list all the json files",
        fileExtensions: ["json"],
        output: ["a/a1.json", "b/b1.json"],
      },
      {
        message: "list all the json & yaml files",
        fileExtensions: ["json", "yaml"],
        output: ["a/a1.json", "b/b1.json", "a/a4.yaml", "b/b4.yaml"],
      },
      {
        message: "list all the json & yaml files exclude folder 'a'",
        excludeFolders: ["a"],
        fileExtensions: ["json", "yaml"],
        output: ["b/b1.json", "b/b4.yaml"],
      },
    ];
    testInput.forEach((data) => {
      it(data.message, async () => {
        const result = await openApiProcessor.listAllFiles(
          `${testDataBaseFolder}/listAllFiles`,
          data.excludeFolders ?? [],
          data.fileExtensions
        );
        chai.assert.deepEqual(
          result.sort(),
          data.output
            .map((file) => path.normalize(`${testDataBaseFolder}/listAllFiles/${file}`))
            .sort()
        );
      });
    });
  });
});
