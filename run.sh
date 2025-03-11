#!/bin/bash

echo "Generating file list..."
node generateFileList.js

# Check if the script was successful
if [ $? -ne 0  ]; then
    echo "❌ Error generating file list. Exiting."
        exit 1
        fi

        echo "✅ File list generated successfully!"
        echo "Starting Vite..."
        npm run dev

