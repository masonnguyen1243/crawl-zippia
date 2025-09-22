import fs from "fs";

// Read the current result file
const inputFile = "./em-test-result.json";
const outputFile = "./em-test-result-reordered.json";

console.log("Reading input file:", inputFile);
const rawData = fs.readFileSync(inputFile, "utf8");
const companies = JSON.parse(rawData);

console.log("Reordering fields...");

// Reorder each company object to have nameEmbedding right after companyName
const reorderedCompanies = companies.map((company) => {
  const { companyName, nameEmbedding, ...otherFields } = company;

  return {
    companyName,
    nameEmbedding,
    ...otherFields,
  };
});

console.log("Writing reordered data to:", outputFile);
fs.writeFileSync(
  outputFile,
  JSON.stringify(reorderedCompanies, null, 2),
  "utf8"
);

console.log(
  "✅ Successfully reordered! nameEmbedding is now right after companyName"
);
console.log("📄 Output saved to:", outputFile);
