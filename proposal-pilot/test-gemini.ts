import { GoogleGenAI } from "@google/genai";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function testConnection() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("❌ GEMINI_API_KEY not found in .env.local");
    process.exit(1);
  }

  console.log("✅ Found GEMINI_API_KEY");
  console.log("Initializing GoogleGenAI client...");
  
  const ai = new GoogleGenAI({ apiKey });

  try {
    // 1. Test basic text generation
    console.log("Testing text generation (gemini-flash-latest)...");
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: "Hello! Please reply with exactly: 'Connection successful.'",
    });
    console.log("Response:", response.text);

    // 2. Test embeddings
    console.log("\nTesting embeddings (gemini-embedding-2)...");
    const embedResponse = await ai.models.embedContent({
      model: "gemini-embedding-2",
      contents: "ProposalPilot test embedding",
    });
    
    if (embedResponse.embeddings && embedResponse.embeddings.length > 0) {
      console.log(`✅ Successfully generated embedding array of size: ${embedResponse.embeddings[0].values?.length}`);
    } else {
      console.error("❌ Failed to generate embeddings");
    }

    console.log("\n🚀 All Gemini connections successful!");
  } catch (error) {
    console.error("\n❌ Error connecting to Gemini API:", error);
  }
}

testConnection();
