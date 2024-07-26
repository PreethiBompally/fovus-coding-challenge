const { EC2Client, RunInstancesCommand } = require("@aws-sdk/client-ec2");

const s3Bucket = process.env.BUCKET_NAME;
const dbTable = process.env.TABLE_NAME;
const amiId = process.env.AMI_ID;

const ec2Client = new EC2Client({ region: "us-east-2" });

exports.handler = async (event, context) => {
    for (const record of event.Records) {
        if (record.eventName === 'INSERT') {
            const newImage = record.dynamodb.NewImage;
            const itemId = newImage.id.S;
            console.log('New item with ID: ', itemId);

            const userDataScript = `#!/bin/bash
echo "UDS started"

# Ensure the environment variables are correctly set for AWS CLI
export AWS_DEFAULT_REGION=us-east-2  # Adjust to your EC2 instance's region
export INSTANCE_ID=$(curl http://169.254.169.254/latest/meta-data/instance-id/)

# Update the system
yum update -y

# Install necessary packages
yum install -y curl wget python3

# Using a virtual environment
python3 -m venv /root/myenv
source /root/myenv/bin/activate

# Install pip for Python3
curl -O https://bootstrap.pypa.io/get-pip.py
python3 get-pip.py

# Install Python packages
pip install boto3 requests

export S3_BUCKET_NAME=${s3Bucket}
export TABLE_NAME=${dbTable}
export ITEM_ID=${itemId}
export AWS_DEFAULT_REGION=us-east-2

# Copy the script from S3
aws s3 cp s3://${s3Bucket}/script.py script.py

# Set script permissions and execute it
chmod +x script.py

python3 script.py

# Deactivate the virtual environment
deactivate

aws ec2 terminate-instances --instance-ids $INSTANCE_ID --region $AWS_DEFAULT_REGION
`;

            const params = {
                ImageId: amiId,
                InstanceType: 't2.micro',
                UserData: Buffer.from(userDataScript).toString('base64'),
                IamInstanceProfile: {
                    Arn: process.env.ROLE
                },
                MaxCount: 1,
                MinCount: 1
            };

            try {
                const command = new RunInstancesCommand(params);
                const response = await ec2Client.send(command);
                const instanceId = response.Instances[0].InstanceId;
                console.log(`Created instance with ID: ${instanceId}`);
            } catch (error) {
                console.error("Error creating EC2 instance:", error);
                return { statusCode: 500, body: JSON.stringify({ error: "Failed to create EC2 instance" }) };
            }
        }
    }

    return { statusCode: 200, body: JSON.stringify({ message: "Processing complete" }) };
};