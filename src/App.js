import React, { useState, useEffect } from "react";
import "./App.css";
// import path from 'path';

function App() {
  const [inputText, setInputText] = useState("");
  const [inputFile, setInputFile] = useState(null);
  const [fileId, setFileId] = useState('fileInput');
  const [apiUrls, setApiUrls] = useState(null);

  useEffect(() => {
    getApiUrls();
  }, []);

  function getApiUrls() {
    fetch('/api_url.txt')
      .then(function(response) {
        return response.text();
      })
      .then(function(text) {
        console.log('Raw text from file:', text);

        // Parse the JSON content
        var urls = JSON.parse(text);

        setApiUrls(urls);
        console.log('Generate API URL:', urls.generateUrl);
        console.log('DynamoDB URL:', urls.DynamoDBUrl);
      })
      .catch(function(error) {
        console.error('Error fetching or parsing API URLs:', error);
      });
  }

  const handleInputChange = (event) => {
    setInputText(event.target.value);
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const fileNameParts = file.name.split('.');
      const fileExtension = fileNameParts[fileNameParts.length - 1].toLowerCase();
      if (['doc', 'docx', 'txt'].includes(fileExtension)) {
        setInputFile(file);
        setFileId('fileChosen');
      } else {
        setInputFile(null);
        setFileId('noFileChosen');
        alert('Please select a .doc, .docx, or .txt file.');
      }
    }
  };


  const handleSubmit = async () => {
    if (!inputFile) {
      alert("Please select a file");
      return;
    }
    
    if (!apiUrls) {
      alert("API URLs not loaded yet. Please try again.");
      return;
    }

    let headers = new Headers();
    headers.append('Content-Type', 'application/json');
    headers.append('Accept', 'application/json');
    try {
      
      const response = await fetch(apiUrls.generateUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ fileName: inputFile.name }),
      });
      
      if (!response.ok) {
        console.log(response.Error)
        throw new Error('Failed to get pre-signed URL');
      }
      const data = await response.json();

      const url = JSON.parse(data['body'])['url'];
      const bucketName = JSON.parse(data['body'])['bucketName'];
      
      const uploadResponse = await fetch(url, {
        method: 'PUT',
        body: inputFile,
        headers: {
          'Content-Type': inputFile.type,
        },
      });

      if (uploadResponse.ok) {
        console.log("File uploaded to S3 bucket successfully!");
      } else {
        throw new Error("Upload failed");
      }

      const file_path = `${bucketName}/${inputFile.name}`;
      const dynamoApiPayload = {
        operation:"create",
        payload:{
          Item: {
              input_text: inputText,
              input_file_path: file_path,
           },
        }
      };

      const dynamoApiResponse = await fetch(apiUrls.DynamoDBUrl,{
        method : "POST",
        headers: {
          "Content-Type": "application/json",
          },
          body: JSON.stringify(dynamoApiPayload),
      });

      if(dynamoApiResponse.ok){
        alert("File uploaded successfully!");
      } else {
        throw new Error("Error calling API");
      }

    } catch (error) {
      console.error("Error:", error);
      if (error.response) {
        console.error("Response data:", await error.response.text());
      }
      alert("Error uploading file. Please try again.");
    }
  };

  return (
    <div className="App">
      <h1 align="center">Fovus Coding Challenge</h1>
      <div className="input-fields">
        <div>
          <label htmlFor="textInput">Text input:</label>
          <input type="text" id="textInput" value={inputText} onChange={handleInputChange}/>
        </div>
        <div>
          <label htmlFor={fileId}>File input:</label>
          <input type="file" onChange={handleFileChange} />
        </div>
        <button onClick={handleSubmit}>Upload</button>
      </div>
    </div>
  );
}

export default App;