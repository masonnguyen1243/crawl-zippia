import axios from "axios";

async function inspectAPIResponse() {
  try {
    const response = await axios.post(
      "https://embeds.talio.vn/embeds",
      {
        text: "Software Engineer",
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: "talio",
        },
      }
    );

    console.log("✅ Full API Response:");
    console.log("Type:", typeof response.data);
    console.log("Keys:", Object.keys(response.data));
    console.log("Full data:", JSON.stringify(response.data, null, 2));

    if (response.data.embedding) {
      console.log("\n📊 Embedding info:");
      console.log("Embedding type:", typeof response.data.embedding);
      console.log(
        "Embedding is array:",
        Array.isArray(response.data.embedding)
      );
      if (Array.isArray(response.data.embedding)) {
        console.log("Embedding length:", response.data.embedding.length);
        console.log("First 5 values:", response.data.embedding.slice(0, 5));
      }
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

inspectAPIResponse();
