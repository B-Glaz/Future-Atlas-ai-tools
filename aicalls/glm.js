import OpenAI from "openai";
import process from 'process';

const openai = new OpenAI({
    apiKey: process.env.DASHSCOPE_API_KEY,
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
});

let reasoningContent = '';
let answerContent = '';
let isAnswering = false;

async function main() {
    const messages = [{ role: 'user', content: 'Who are you?' }];

    const stream = await openai.chat.completions.create({
        model: 'deepseek-r1',
        messages,
        stream: true,
    });

    console.log('\n' + '='.repeat(20) + 'Thinking process' + '='.repeat(20) + '\n');

    for await (const chunk of stream) {
        if (chunk.choices?.length) {
            const delta = chunk.choices[0].delta;
            if (delta.reasoning_content !== undefined && delta.reasoning_content !== null) {
                if (!isAnswering) {
                    process.stdout.write(delta.reasoning_content);
                }
                reasoningContent += delta.reasoning_content;
            }

            if (delta.content !== undefined && delta.content) {
                if (!isAnswering) {
                    console.log('\n' + '='.repeat(20) + 'Full response' + '='.repeat(20) + '\n');
                    isAnswering = true;
                }
                process.stdout.write(delta.content);
                answerContent += delta.content;
            }
        }
    }
}

main();