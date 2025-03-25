import { GoogleGenerativeAI } from "@google/generative-ai";
// Replace with your actual API key
const API_KEY = process.env.GEMINI_API_KEY; ;
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });

async function getTouristAttractions(origin, destination, keywords) {
  try {
    const prompt1 = `List 8 popular tourist attractions with their coordinates which a user can visit while traveling from ${origin} to ${destination}. The places should be really popular tourist attractions with keywords {${keywords}} and should be somewhat evenly distributed geographically along the route from ${origin} to ${destination}. Format the output as a list with the place name followed by its description and coordinates.`;

    const result1 = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt1 }] }],
    });
    const response1 = result1.response.candidates[0].content.parts[0].text;
    const places1 = parseGeminiResponse(response1);

    if (places1.length < 8) {
      console.warn("Could not find 8 unique places for the first set. Found:", places1.length);
    }

    const excludedPlaces = places1.map(place => place.name).join(", ");

    const prompt2 = `List another 8 popular tourist attractions with their coordinates which a user can visit while traveling from ${origin} to ${destination}. The places should be really popular tourist attractions with keywords {${keywords}} and should be somewhat evenly distributed geographically along the route from ${origin} to ${destination}. Ensure that none of these places are similar to the following list: ${excludedPlaces}. Format the output as a list with the place name followed by its description and coordinates.`;

    const result2 = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt2 }] }],
    });
    const response2 = result2.response.candidates[0].content.parts[0].text;
    const places2 = parseGeminiResponse(response2);

    if (places2.length < 8) {
      console.warn("Could not find 8 unique places for the second set. Found:", places2.length);
    }

    // Basic check to ensure no overlap (can be improved with more sophisticated comparison)
    const uniquePlaces2 = places2.filter(place => !places1.some(p1 => p1.name.toLowerCase() === place.name.toLowerCase()));

    return {
      set1: places1.slice(0, 8),
      set2: uniquePlaces2.slice(0, 8),
    };
  } catch (error) {
    console.error("Error generating content:", error);
    return { set1:, set2:};
  }
}

function parseGeminiResponse(responseText) {
  const places =;
  const lines = responseText.split('\n').filter(line => line.trim() !== '');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("- ")) {
      const parts = lines[i].substring(2).split(" (");
      if (parts.length >= 2) {
        const name = parts[0].trim();
        const remaining = parts.slice(1).join(" (");
        const descriptionParts = remaining.split(") [");
        if (descriptionParts.length === 2) {
          const description = descriptionParts[0].trim() + ")";
          const coordinatesPart = descriptionParts[1].trim();
          if (coordinatesPart.endsWith("]")) {
            const coordinatesStr = coordinatesPart.slice(0, -1).trim();
            const [latitudeStr, longitudeStr] = coordinatesStr.split(",").map(s => s.trim());
            const latitude = parseFloat(latitudeStr);
            const longitude = parseFloat(longitudeStr);
            if (!isNaN(latitude) && !isNaN(longitude)) {
              places.push({ name, description, coordinates: { latitude, longitude } });
            } else {
              console.warn("Could not parse coordinates:", coordinatesStr, "for place:", name);
            }
          } else {
            console.warn("Could not find closing bracket for coordinates for place:", name);
          }
        } else {
          console.warn("Could not parse description and coordinates for place:", name);
        }
      } else {
        console.warn("Could not split name and description/coordinates for line:", lines[i]);
      }
    }
  }
  return places;
}

// Example usage:
const originCity = "Kochi";
const destinationCity = "Trivandrum";
const attractionKeywords = "viewpoint, historic places";

getTouristAttractions(originCity, destinationCity, attractionKeywords)
  .then(result => {
    console.log("Set 1:");
    if (result.set1 && result.set1.length > 0) {
      result.set1.forEach((place, index) => {
        console.log(`${index + 1}. ${place.name}: ${place.description} [${place.coordinates.latitude}, ${place.coordinates.longitude}]`);
      });
    } else {
      console.log("No places found for Set 1.");
    }

    console.log("\nSet 2:");
    if (result.set2 && result.set2.length > 0) {
      result.set2.forEach((place, index) => {
        console.log(`${index + 1}. ${place.name}: ${place.description} [${place.coordinates.latitude}, ${place.coordinates.longitude}]`);
      });
    } else {
      console.log("No places found for Set 2.");
    }
  })
  .catch(error => {
    console.error("Error:", error);
  });