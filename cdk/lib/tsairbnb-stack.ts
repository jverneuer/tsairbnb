import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { Duration, Stack, StackProps } from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as cloudfrontOrigins from "aws-cdk-lib/aws-cloudfront-origins";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as logs from "aws-cdk-lib/aws-logs";
import { configParams } from "./config.js";

export interface TsairbnbStackProps extends StackProps {
  /** Lambda container platform. linux/amd64 = cheaper x86, linux/arm64 = Graviton. */
  readonly targetPlatform: "linux/amd64" | "linux/arm64";
  /** CloudFront cache TTL for identical endpoint queries. */
  readonly cacheTtl?: Duration;
}

export class TsairbnbStack extends Stack {
  constructor(scope: Construct, id: string, props: TsairbnbStackProps) {
    super(scope, id, props);

    const { targetPlatform, cacheTtl = Duration.minutes(10) } = props;

    // ---- Lambda (container image: Node 24 + curl-impersonate) ----
    const fn = new lambda.DockerImageFunction(this, "Api", {
      code: lambda.DockerImageCode.fromImageAsset(".", {
        platform: targetPlatform as unknown as cdk.aws_ecr_assets.Platform,
        buildArgs: {
          TARGETPLATFORM: targetPlatform,
          ARCH: targetPlatform === "linux/arm64" ? "aarch64" : "x86_64",
        },
        // ponytail: ECR auto-creates; if you pre-create a repo for tagging policy, pass `repository`.
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

    const fnUrl = fn.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      invokeMode: lambda.InvokeMode.BUFFERED,
      cors: { allowedOrigins: ["*"], allowedMethods: [lambda.HttpMethod.ALL] },
    });

    // ---- CloudFront (cache + origin = Lambda Function URL) ----
    // NOTE: WAFv2 is not attached by default. CloudFront-scoped WAF requires us-east-1.
    // If you need rate-limiting, create a CLOUDFRONT-scoped WebACL in us-east-1 and
    // attach it manually or via a cross-region CDK stack.
    const distribution = new cloudfront.Distribution(this, "Cdn", {
      defaultBehavior: {
        origin: new cloudfrontOrigins.FunctionUrlOrigin(fnUrl),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        cachePolicy: new cloudfront.CachePolicy(this, "CachePolicy", {
          defaultTtl: cacheTtl,
          minTtl: cacheTtl,
          maxTtl: Duration.hours(1),
          queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
        }),
        responseHeadersPolicy:
          cloudfront.ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS_WITH_PREFLIGHT,
        // ponytail: CloudFront -> Lambda Fn URL is http only; restricted via WAF + CF.
      },
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    });

    // ---- Config in SSM (hot-editable: UA pool, locale, hashes) ----
    new ssm.StringParameter(this, "ConfigEndpoint", {
      parameterName: "/tsairbnb/endpoint-config",
      stringValue: configParams(),
      description: "tsairbnb runtime config — JSON: userAgents, locale, currency, hashOverrides",
      tier: ssm.ParameterTier.STANDARD,
    });

    new cdk.CfnOutput(this, "DistributionUrl", {
      value: `https://${distribution.distributionDomainName}`,
      description: "Public tsairbnb API URL (CloudFront).",
    });
    new cdk.CfnOutput(this, "FunctionUrl", {
      value: fnUrl.url,
      description: "Direct Lambda Function URL (unthrottled — prefer the CloudFront URL).",
    });
  }
}
