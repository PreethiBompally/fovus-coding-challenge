import boto3
import os
import json

s3_bucket = os.getenv('BUCKET_NAME')
db_table = os.getenv('TABLE_NAME')
ami_id = os.getenv('AMI_ID')

def handler(event, context):
    for record in event['Records']:
        if record['eventName'] == 'INSERT':
            new_image = record['dynamodb']['NewImage']
            item_id = new_image['id']['S']
            print('New item with ID: ', item_id)

    user_data_script = f"""#!/bin/bash
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

    export S3_BUCKET_NAME={s3_bucket}
    export TABLE_NAME={db_table}
    export ITEM_ID={item_id}
    export AWS_DEFAULT_REGION=us-east-2

    # Copy the script from S3
    aws s3 cp s3://{s3_bucket}/script.py script.py

    # Set script permissions and execute it
    chmod +x script.py

    python3 script.py
    
    # Deactivate the virtual environment
    deactivate

    aws ec2 terminate-instances --instance-ids $INSTANCE_ID --region $AWS_DEFAULT_REGION
    """

    ec2 = boto3.client('ec2')
    response = ec2.run_instances(ImageId = ami_id,
        InstanceType = 't2.micro',
        UserData=user_data_script,
        IamInstanceProfile={
        'Arn': os.getenv('ROLE')
        },
        MaxCount = 1,
        MinCount = 1)
    
    instance_id = response['Instances'][0]['InstanceId']
    print(f'Created instance with ID: {instance_id}')
    return {"status": 200}