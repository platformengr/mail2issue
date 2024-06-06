import stream from 'stream';

it("ss", async () => {
    const buffer = Buffer.from('This is a sample text for the buffer');

    const bufferStream = new stream.PassThrough();
    bufferStream.end(buffer);

    bufferStream.on('data', (chunk) => console.log(chunk.toString()));
});