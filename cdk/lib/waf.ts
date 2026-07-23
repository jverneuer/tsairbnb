import { Construct } from "constructs";
import * as wafv2 from "aws-cdk-lib/aws-wafv2";

interface WebAclOpts {
  readonly rateLimit: number;
}

/**
 * CloudFront-scoped WAFv2 WebACL with a rate-based rule.
 * One IP exceeding `rateLimit` requests / 5 min is throttled.
 */
export function buildWebAcl(scope: Construct, id: string, opts: WebAclOpts): wafv2.CfnWebACL {
  return new wafv2.CfnWebACL(scope, id, {
    scope: "CLOUDFRONT",
    defaultAction: { allow: {} },
    visibilityConfig: {
      cloudWatchMetricsEnabled: true,
      metricName: "tsairbnb-waf",
      sampledRequestsEnabled: true,
    },
    rules: [
      {
        name: "rate-limit",
        priority: 1,
        action: { block: {} },
        visibilityConfig: {
          cloudWatchMetricsEnabled: true,
          metricName: "rate-limit",
          sampledRequestsEnabled: true,
        },
        statement: {
          rateBasedStatement: { limit: opts.rateLimit, aggregateKeyType: "IP" },
        },
      },
    ],
  });
}
