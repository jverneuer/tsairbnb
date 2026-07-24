#!/usr/bin/env tsx
import * as cdk from "aws-cdk-lib";
import { TsairbnbStack } from "../lib/tsairbnb-stack.js";

const app = new cdk.App();

const account = process.env.CDK_DEFAULT_ACCOUNT ?? process.env.AWS_ACCOUNT ?? "";
const platform =
  (process.env.TARGETPLATFORM as "linux/amd64" | "linux/arm64") ?? "linux/amd64";

const regions = ["eu-west-1", "us-east-1"] as const;

for (const region of regions) {
  // Stack name per region: TsairbnbStackEuWest1, TsairbnbStackUsEast1
  const stackId = `TsairbnbStack${region
    .split("-")
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join("")
    .replace("1", "1")}`;

  new TsairbnbStack(app, stackId, {
    env: { account, region },
    targetPlatform: platform,
  });
}

app.synth();
