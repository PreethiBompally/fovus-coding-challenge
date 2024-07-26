const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const s3Client = new S3Client({ region: process.env.AWS_REGION1 });

exports.handler = async (event) => {
    console.log('Received event:', JSON.stringify(event));
    let body;
    try {
        body = JSON.stringify(event) ? JSON.parse(JSON.stringify(event)) : {};
    } catch (error) {
        console.error('Failed to parse event body:', error);
        return {
            statusCode: 400,
            headers: {
                'Access-Control-Allow-Origin': 'http://localhost:3000',
                'Access-Control-Allow-Credentials': true,
            },
            body: JSON.stringify({ error: 'Invalid request body' }),
        };
    }
    console.log('Parsed body:', body);
    const fileName = body.fileName;
    console.log('fileName:', fileName);
    if (!fileName) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'fileName is required' }),
        };
    }
    const command = new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: fileName,
    });
    try {
        const signedUrl = await getSignedUrl(s3Client, command);
        return {
            statusCode: 200,
            body: JSON.stringify({ url: signedUrl,bucketName: process.env.S3_BUCKET_NAME }),
        };
    } catch (err) {
        console.error(err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to generate pre-signed URL' }),
        };
    }
};