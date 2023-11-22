import * as fs from 'fs';
import { createWriteStream } from 'fs';
import axios from 'axios';
import { DownloaderHelper } from 'node-downloader-helper';

export async function downloadAndSaveFiles(fileList) {
  for await (const { filePath, url, filename, accessToken } of fileList) {
    try {
      // Create directories recursively if they don't exist
      fs.mkdirSync(filePath, { recursive: true });
      console.log(`Downloading recording files on ${ filePath }...`)
      // Download the file
      const response = await axios({
        method: 'get',
        url: url,
        responseType: 'stream',
        headers: {
          Authorization: accessToken,
        }
      });

      // Create a writable stream to save the file
      const writer = createWriteStream(filename);

      // Wait for the stream to finish writing
      return await new Promise((resolve, reject) => {
        response.data.pipe(writer);
        writer.on('finish', () => {
          console.log(`Download ${ filePath } Completed`)
          resolve()
        });
        writer.on('error', (error) => {
          console.error('Error writing file:', error);
          reject()     
        });
      });

    } catch (error) {
      console.error('Error downloading and saving file:', error);
    }
  }
}

export async function downloadAndSave(fileList) {
  for await (const { filePath, url, filename, accessToken } of fileList) {
    try {
      // Create directories recursively if they don't exist
      fs.mkdirSync(filePath, { recursive: true });

      const dl = new DownloaderHelper(url, filePath, {
        headers: {
          Authorization: accessToken
        },
        removeOnStop: false,
        removeOnFail: false,
        resumeOnIncomplete: true,
        resumeOnIncompleteMaxRetry: 10,
        resumeIfFileExists: true,
        // fileName: filename,
      });

      await new Promise ((resolve, reject) => {
        dl.on('end', () => {
          console.log(`Download ${ filePath } Completed`)
          resolve()
        });

        dl.on('error', (err) => {
          console.log(`Download ${ filePath }  Failed`, err)
          reject()
        });

        dl.start().catch(err => {
          console.error(err)
          reject()
        });
      })

      
      // Download the file
      // const response = await axios({
      //   method: 'get',
      //   url: url,
      //   responseType: 'stream',
      //   headers: {
      //     Authorization: accessToken,
      //   }
      // });



      // Create a writable stream to save the file
      // const writer = createWriteStream(filename);

      // Wait for the stream to finish writing
      // await new Promise((resolve, reject) => {
      //   response.data.pipe(writer);
      //   writer.on('finish', resolve);
      //   writer.on('error', reject);
      // });

    } catch (error) {
      console.error('Error downloading and saving file:', error.message);
    }
  }
}

export async function downloadSingleFile( filePath, url, filename, accessToken ) {
  // Create directories recursively if they don't exist
  fs.mkdirSync(filePath, { recursive: true });

  const dl = new DownloaderHelper(url, filePath, {
    headers: {
      Authorization: accessToken
    },
    timeout: 60000,
    retry: { maxRetries: 10, delay: 5000 },
    
  });

  await new Promise ((resolve, reject) => {
    dl.on('start', () => {
      console.log(`Downloading file ${ filename }...`)
    })
    dl.on('end', () => {
      console.log(`Download ${ filePath } Completed`)
      resolve()
    });

    dl.on('error', (err) => {
      console.log(`Download ${ filePath }  Failed`, err)
      reject()
    });

    dl.start().catch(err => {
      console.error(err)
      reject()
    });
  })

}

export async function downloadAll(fileList) {
  for (const fileRow of fileList) {
    const { filePath, url, filename, accessToken } = fileRow
    console.log(`Initiating files download...`)
    await downloadSingleFile( filePath, url, filename, accessToken );
  }
}