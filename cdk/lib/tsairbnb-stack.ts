import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { Duration, Stack, StackProps } from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as logs from "aws-cdk-lib/aws-logs";
import { configParams } from "./config.js";

export interface TsairbnbStackProps extends StackProps {
  /** Lambda container platform. linux/amd64 = cheaper x86, linux/arm64 = Graviton. */
  readonly targetPlatform: "linux/amd64" | "linux/arm64";
}

export class TsairbnbStack extends Stack {
  constructor(scope: Construct, id: string, props: TsairbnbStackProps) {
    super(scope, id, props);

    const { targetPlatform } = props;

    // ---- Lambda (container image: Node 24 + curl-impersonate) ----
    const fn = new lambda.DockerImageFunction(this, "Api", {
      code: lambda.DockerImageCode.fromImageAsset(".", {
        platform: targetPlatform as unknown as cdk.aws_ecr_assets.Platform,
        buildArgs: {
          TARGETPLATFORM: targetPlatform,
          ARCH: targetPlatform === "linux/arm64" ? "aarch64" : "x86_64",
        },
      }),
      architecture:
        targetPlatform === "linux/arm64"
          ? lambda.Architecture.ARM_64
          : lambda.Architecture.X86_64,
      memorySize: 1024,
      timeout: Duration.seconds(30),
      logGroup: new logs.LogGroup(this, "ApiLogs", {
        retention: logs.RetentionDays.TWO_WEEKS,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }),
    });

    // Grant Lambda SSM read access for its region-scoped config
    const ssmParamName = `/tsairbnb/${Stack.of(this).region}/endpoint-config`;
    fn.role?.addToPrincipalPolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: ["ssm:GetParameter"],
        resources: [cdk.Arn.format({ service: "ssm", resource: "parameter", resourceName: ssmParamName, region: "", account: "" }, this)],
      }),
    );

    const fnUrl = fn.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      invokeMode: lambda.InvokeMode.BUFFERED,
      cors: { allowedOrigins: ["*"], allowedMethods: [lambda.HttpMethod.ALL] },
    });

    // ---- Config in SSM (hot-editable: UA pool, locale, hashes) ----
    const region = Stack.of(this).region;
    new ssm.StringParameter(this, "ConfigEndpoint", {
      parameterName: `/tsairbnb/${region}/endpoint-config`,
      stringValue: configParams(),
      description: `tsairbnb runtime config (${region}) — JSON: userAgents, locale, currency, hashOverrides`,
      tier: ssm.ParameterTier.STANDARD,
    });

    new cdk.CfnOutput(this, "FunctionUrl", {
      value: fnUrl.url,
      description: "Lambda Function URL.",
    });
  }
}
