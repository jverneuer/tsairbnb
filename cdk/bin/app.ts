#!/usr/bin/env tsx
import * as cdk from "aws-cdk-lib";
import { TsairbnbStack } from "../lib/tsairbnb-stack.js";

const app = new cdk.App();

const env: cdk.Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT ?? process.env.AWS_ACCOUNT ?? "",
  region: process.env.CDK_DEFAULT_REGION ?? process.env.AWS_REGION ?? "",
};

new TsairbnbStack(app, "TsairbnbStack", {
  env,
  targetPlatform:
    (process.env.TARGETPLATFORM as "linux/amd64" | "linux/arm64") ?? "linux/amd64",
});

app.synth();
