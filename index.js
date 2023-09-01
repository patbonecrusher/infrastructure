// "use strict";
// const pulumi = require("@pulumi/pulumi");
// const aws = require("@pulumi/aws");
// const awsx = require("@pulumi/awsx");

// // Create an AWS resource (S3 Bucket)
// const bucket = new aws.s3.Bucket("my-bucket");

// // Export the name of the bucket
// exports.bucketName = bucket.id;

// // need a bucket to store photo
// // need some lambda
// // need database
// // need a bucket to store front end
// // need a cloudfront pointing to the website


const aws = require("@pulumi/aws");
const pulumi = require("@pulumi/pulumi");
const mime = require("mime");

// Update your siteBucket declaration to this
let siteBucket = new aws.s3.Bucket("genealogy.patlaplante.com", {
    website: {
        indexDocument: "index.html",
    },
});

// Create an S3 Bucket Policy to allow public read of all objects in bucket
// This reusable function can be pulled out into its own module
function publicReadPolicyForBucket(bucketName) {
    return JSON.stringify({
        Version: "2012-10-17",
        Statement: [{
            Effect: "Allow",
            Principal: "*",
            Action: [
                "s3:GetObject"
            ],
            Resource: [
                `arn:aws:s3:::${bucketName}/*` // policy refers to bucket name explicitly
            ]
        }]
    })
}

// Set the access policy for the bucket so all objects are readable
let bucketPolicy = new aws.s3.BucketPolicy("bucketPolicy", {
    bucket: siteBucket.bucket, // depends on siteBucket -- see explanation below
    policy: siteBucket.bucket.apply(publicReadPolicyForBucket)
    // transform the siteBucket.bucket output property -- see explanation below
});

exports.websiteUrl = siteBucket.websiteEndpoint; // output the endpoint as a stack output

let siteDir = "www"; // directory for content files

// For each file in the directory, create an S3 object stored in `siteBucket`
for (let item of require("fs").readdirSync(siteDir)) {
    let filePath = require("path").join(siteDir, item);
    let object = new aws.s3.BucketObject(item, {
        bucket: siteBucket,
        source: new pulumi.asset.FileAsset(filePath),     // use FileAsset to point to a file
        contentType: mime.getType(filePath) || undefined, // set the MIME type of the file
    });
}





async function createAliasRecord(targetDomain, distribution) {
    const domainParts = getDomainAndSubdomain(targetDomain);
    const hostedZone = await aws.route53.getZone({ name: domainParts.parentDomain });
    return new aws.route53.Record(
        targetDomain,
        {
            name: domainParts.subdomain,
            zoneId: hostedZone.zoneId,
            type: "A",
            aliases: [
            {
                name: distribution.domainName,
                zoneId: distribution.hostedZoneId,
                evaluateTargetHealth: true,
            },
        ],
    });
}

const aRecord = createAliasRecord(config.targetDomain, cdn);

