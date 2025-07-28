import ModelClient, { isUnexpected } from "@azure-rest/ai-inference";
import { AzureKeyCredential } from "@azure/core-auth";

const token = process.env["GITHUB_TOKEN"];
const endpoint = "https://models.github.ai/inference";
const model = "xai/grok-3";

export async function generateAIResponse(messages) {
  const client = ModelClient(
    endpoint,
    new AzureKeyCredential(token),
  );

  const response = await client.path("/chat/completions").post({
    body: {
      messages: messages,
      temperature: 1.0,
      top_p: 1.0,
      model: model
    }
  });

  if (isUnexpected(response)) {
    throw response.body.error;
  }

  return response.body.choices[0].message.content;
}

export async function handleHeavyTask(req, res) {
  try {
    const userMessage = req.body.message;
    const messages = [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: userMessage }
    ];

    const aiResponse = await generateAIResponse(messages);
    res.status(200).json({ status: "success", response: aiResponse });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
}