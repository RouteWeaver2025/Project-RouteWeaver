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
    return { set1: [], set2: []};
  }
}

// FUNCTION 1: For @suggest.js - Gets popular places between origin and destination
async function getSuggest(origin, destination, keyword) {
  try {
    const prompt1 = `List 8 popular tourist attractions with their coordinates that are STRICTLY located along or directly adjacent to the main driving route from ${origin} to ${destination}.

Focus on attractions with these STRICT requirements:
1. Places MUST be within 5-10km maximum from the EXACT main highway/road route between ${origin} and ${destination}
2. Places must be DIRECTLY accessible from the main route with minimal detours
3. Only include genuine, well-known tourist attractions in Kerala, India
4. Distribute places somewhat evenly along the entire route
5. Focus on attractions related to: ${keyword}
6. Exclude any place that would require a significant detour (>10km) from the main route
7. For each place, specify the approximate distance from the main route in km
8. Use PRECISE, ACCURATE coordinates for each location

Format each place as:
- [Place Name] ([Brief Description including approximate distance from main route in km]) [latitude, longitude]`;

    const result1 = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt1 }] }],
    });
    const response1 = result1.response.candidates[0].content.parts[0].text;
    const places1 = parseGeminiResponse(response1);

    // Log for debugging
    console.log(`First set parsed ${places1.length} places from Gemini`);
    if (places1.length > 0) {
      places1.forEach((place, i) => {
        console.log(`Place ${i+1}: ${place.name} at [${place.coordinates.latitude}, ${place.coordinates.longitude}]`);
      });
    }

    // Get names of first set to exclude from second set
    const excludedPlaces = places1.map(place => place.name).join(", ");

    const prompt2 = `List 8 more popular tourist attractions with their coordinates that are STRICTLY located along or directly adjacent to the main driving route from ${origin} to ${destination}.

Focus on attractions with these STRICT requirements:
1. Places MUST be within 5-10km maximum from the EXACT main highway/road route between ${origin} and ${destination}
2. Places must be DIFFERENT from: ${excludedPlaces}
3. Only include genuine, well-known tourist attractions in Kerala, India
4. Distribute places somewhat evenly along the entire route
5. Focus on attractions related to: ${keyword}
6. Exclude any place that would require a significant detour (>10km) from the main route
7. For each place, specify the approximate distance from the main route in km
8. Use PRECISE, ACCURATE coordinates for each location

Format each place as:
- [Place Name] ([Brief Description including approximate distance from main route in km]) [latitude, longitude]`;

    const result2 = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt2 }] }],
    });
    const response2 = result2.response.candidates[0].content.parts[0].text;
    const places2 = parseGeminiResponse(response2);
    
    // Log for debugging
    console.log(`Second set parsed ${places2.length} places from Gemini`);
    if (places2.length > 0) {
      places2.forEach((place, i) => {
        console.log(`Place ${i+1}: ${place.name} at [${place.coordinates.latitude}, ${place.coordinates.longitude}]`);
      });
    }

    // Remove any duplicates
    const uniquePlaces2 = places2.filter(place => !places1.some(p1 => 
      p1.name.toLowerCase() === place.name.toLowerCase() ||
      // Also check for similar names (e.g. "Beach" vs "Sea Beach")
      (p1.name.toLowerCase().includes(place.name.toLowerCase()) || 
       place.name.toLowerCase().includes(p1.name.toLowerCase()))
    ));

    // Filter out places with obviously wrong coordinates (e.g., not in Kerala)
    const keralaLatRange = [8.2, 12.8];
    const keralaLongRange = [74.8, 77.8];
    
    const validPlaces1 = places1.filter(place => 
      place.coordinates.latitude >= keralaLatRange[0] && 
      place.coordinates.latitude <= keralaLatRange[1] &&
      place.coordinates.longitude >= keralaLongRange[0] &&
      place.coordinates.longitude <= keralaLongRange[1]
    );
    
    const validPlaces2 = uniquePlaces2.filter(place => 
      place.coordinates.latitude >= keralaLatRange[0] && 
      place.coordinates.latitude <= keralaLatRange[1] &&
      place.coordinates.longitude >= keralaLongRange[0] &&
      place.coordinates.longitude <= keralaLongRange[1]
    );
    
    console.log(`After coordinate validation: ${validPlaces1.length} places in set 1, ${validPlaces2.length} places in set 2`);

    return {
      set1: validPlaces1.slice(0, 8),
      set2: validPlaces2.slice(0, 8),
    };
  } catch (error) {
    console.error("Error in getSuggest:", error);
    return { set1: [], set2: [] };
  }
}

// FUNCTION 2: For @options.js - Gets nearby and distant popular places from origin
async function getOptions(origin) {
  try {
    const prompt1 = `List 8 popular tourist attractions within 80km of ${origin} with their coordinates. These should be diverse places including natural attractions, historic sites, cultural spots, and entertainment venues. Each should be a distinct type of attraction. Format each place as:
- [Place Name] ([Brief Description]) [latitude, longitude]
Include the approximate distance in km from ${origin} in the description.`;

    const result1 = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt1 }] }],
    });
    const response1 = result1.response.candidates[0].content.parts[0].text;
    const nearbyPlaces = parseGeminiResponse(response1);

    // Get names of nearby places to exclude from distant places
    const excludedPlaces = nearbyPlaces.map(place => place.name).join(", ");

    const prompt2 = `List 8 popular tourist attractions between 100km and 1000km from ${origin} with their coordinates. These should be major tourist destinations worth traveling longer distances to visit. Include diverse options like beach destinations, mountain retreats, historic cities, and natural wonders. Each should be distinct from the others and from these nearby places: ${excludedPlaces}. Format each place as:
- [Place Name] ([Brief Description]) [latitude, longitude]
Include the approximate distance in km from ${origin} in the description.`;

    const result2 = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt2 }] }],
    });
    const response2 = result2.response.candidates[0].content.parts[0].text;
    const distantPlaces = parseGeminiResponse(response2);

    return {
      nearbyPlaces: nearbyPlaces.slice(0, 8),
      distantPlaces: distantPlaces.slice(0, 8)
    };
  } catch (error) {
    console.error("Error in getOptions:", error);
    return { nearbyPlaces: [], distantPlaces: [] };
  }
}

// Helper function to detect near-duplicate place names
function removeDuplicateDestinations(places) {
  if (!places || !Array.isArray(places) || places.length === 0) return places;
  
  // Function to normalize place names for comparison
  const normalizeName = (name) => {
    return name.toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ')    // Normalize spaces
      .trim();
  };
  
  // Function to check if two place names are very similar
  const areSimilarNames = (name1, name2) => {
    // Direct inclusion check
    if (name1.includes(name2) || name2.includes(name1)) return true;
    
    // Word overlap check - if they share more than 50% of words, consider them similar
    const words1 = name1.split(' ');
    const words2 = name2.split(' ');
    
    const commonWords = words1.filter(word => 
      words2.some(w2 => w2 === word || w2.includes(word) || word.includes(w2))
    );
    
    const overlapRatio = commonWords.length / Math.min(words1.length, words2.length);
    return overlapRatio > 0.5;
  };
  
  const uniquePlaces = [];
  const normalizedNames = [];
  
  for (const place of places) {
    const normalized = normalizeName(place.name);
    
    // Check if we already have a similar place
    const isDuplicate = normalizedNames.some(existingName => 
      areSimilarNames(normalized, existingName)
    );
    
    if (!isDuplicate) {
      normalizedNames.push(normalized);
      uniquePlaces.push(place);
    } else {
      console.log(`Filtered out duplicate destination: ${place.name}`);
    }
  }
  
  console.log(`Removed ${places.length - uniquePlaces.length} duplicate destinations`);
  return uniquePlaces;
}

// FUNCTION 3: For @smartvacay.js - Gets destinations based on trip duration
async function getCozy(origin, tripDays = 2) {
  try {
    // Determine distance ranges based on trip duration
    // For 1-day trips: short distances (30-80km)
    // For 2-day trips: medium to long distances (100-400km)
    let shortDistanceRange, mediumDistanceRange, longDistanceRange;
    let shortCount, mediumCount, longCount;
    
    if (tripDays === 1) {
      // For 1-day trips, focus on shorter distances (up to ~100km)
      shortDistanceRange = { min: 30, max: 60 };
      mediumDistanceRange = { min: 60, max: 100 };
      longDistanceRange = { min: 100, max: 150 }; // Still include some longer options
      
      shortCount = 6; // Prioritize short distances for day trips
      mediumCount = 3;
      longCount = 1; // Just a few longer options
    } else {
      // For 2-day trips, focus on medium-to-long distances (100-400km)
      shortDistanceRange = { min: 60, max: 100 };
      mediumDistanceRange = { min: 100, max: 250 };
      longDistanceRange = { min: 250, max: 400 };
      
      shortCount = 2; // A few shorter options
      mediumCount = 5; // Prioritize medium distances
      longCount = 3; // More longer options
    }
    
    console.log(`Getting destinations for ${tripDays}-day trip from ${origin}: ${shortCount} short (${shortDistanceRange.min}-${shortDistanceRange.max}km), ${mediumCount} medium (${mediumDistanceRange.min}-${mediumDistanceRange.max}km), ${longCount} long (${longDistanceRange.min}-${longDistanceRange.max}km)`);
    
    const prompt = `I need a detailed selection of tourist attractions near ${origin} with their precise coordinates for a ${tripDays}-day trip:

1. First, list ${shortCount} popular attractions within ${shortDistanceRange.min}-${shortDistanceRange.max}km of ${origin} (ideal for a ${tripDays === 1 ? 'day trip' : 'first day of a 2-day trip'}).
2. Then, list ${mediumCount} attractions between ${mediumDistanceRange.min}-${mediumDistanceRange.max}km from ${origin} (${tripDays === 1 ? 'farther day trips' : 'good for a 2-day trip'}).
3. Finally, list ${longCount} attractions between ${longDistanceRange.min}-${longDistanceRange.max}km from ${origin} (${tripDays === 1 ? 'ambitious day trips' : 'destinations worth an overnight stay'}).

CRITICAL REQUIREMENTS:
- Each place MUST be completely different from all others (different types of attractions)
- Include diverse attractions: natural sites, historical places, adventure spots, cultural destinations
- EVERY place MUST have ACCURATE latitude and longitude coordinates within Kerala, India
- NEVER use coordinates outside of Kerala (8.2-12.8 latitude, 74.8-77.8 longitude)
- The distance from ${origin} MUST be within the specified range for each category
- Include the EXACT distance from ${origin} in kilometers in each description
- Tailor suggestions specifically for ${tripDays === 1 ? 'day trips (returnable within same day)' : '2-day trips with overnight stay'}

For each place, include:
- Precise name with proper capitalization
- Brief description (1 sentence) including exact distance from ${origin} in km
- CORRECT latitude and longitude coordinates 

Format each place exactly as:
- [Place Name] ([Brief description including EXACT distance from ${origin} in km]) [latitude, longitude]`;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });
    const response = result.response.candidates[0].content.parts[0].text;
    const allPlaces = parseGeminiResponse(response);

    // If we didn't get enough places, try once more with a different prompt
    if (allPlaces.length < 8) {
      console.log(`First try only returned ${allPlaces.length} places, trying again with a different prompt`);
      
      const backupPrompt = `I need at least 10 diverse tourist attractions near ${origin}, Kerala with precise coordinates for a ${tripDays}-day trip.

Please provide a mix of:
- ${shortCount} attractions within ${shortDistanceRange.min}-${shortDistanceRange.max}km (short distance)
- ${mediumCount} attractions within ${mediumDistanceRange.min}-${mediumDistanceRange.max}km (medium distance)
- ${longCount} attractions within ${longDistanceRange.min}-${longDistanceRange.max}km (long distance)

CRITICAL REQUIREMENTS:
- Each place MUST have a different name and be a different type of attraction
- Only provide attractions within Kerala state boundaries (8.2-12.8° latitude, 74.8-77.8° longitude)
- Make sure EVERY latitude and longitude is correct and within Kerala
- For ${tripDays === 1 ? 'day trips' : '2-day trips'}, focus on attractions that are ${tripDays === 1 ? 'accessible within a day' : 'worth staying overnight'}
- The EXACT distance from ${origin} MUST be included in kilometers 

Format each entry exactly as:
- [Place Name] ([Brief description with exact distance from ${origin} in km]) [latitude, longitude]`;

      const backupResult = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: backupPrompt }] }],
      });
      
      const backupResponse = backupResult.response.candidates[0].content.parts[0].text;
      const backupPlaces = parseGeminiResponse(backupResponse);
      
      // Combine places from both attempts, removing duplicates
      const combinedPlaces = [...allPlaces];
      
      // Add places from backup that aren't already in allPlaces
      for (const backupPlace of backupPlaces) {
        if (!allPlaces.some(p => p.name.toLowerCase() === backupPlace.name.toLowerCase())) {
          combinedPlaces.push(backupPlace);
        }
      }
      
      console.log(`After backup attempt, got ${combinedPlaces.length} total places`);
      allPlaces.length = 0; // Clear the array
      allPlaces.push(...combinedPlaces); // Add the combined places
    }

    // Verify coordinates are within Kerala's boundaries
    const keralaLatRange = [8.2, 12.8];
    const keralaLongRange = [74.8, 77.8];
    
    const validPlaces = allPlaces.filter(place => {
      // Validate latitude
      if (!place.coordinates || 
          typeof place.coordinates.latitude !== 'number' || 
          isNaN(place.coordinates.latitude)) {
        console.warn(`Invalid latitude for place: ${place.name}`);
        return false;
      }
      
      // Validate longitude
      if (typeof place.coordinates.longitude !== 'number' || 
          isNaN(place.coordinates.longitude)) {
        console.warn(`Invalid longitude for place: ${place.name}`);
        return false;
      }
      
      // Check if coordinates are within Kerala's boundaries
      const isInKerala = 
        place.coordinates.latitude >= keralaLatRange[0] && 
        place.coordinates.latitude <= keralaLatRange[1] &&
        place.coordinates.longitude >= keralaLongRange[0] &&
        place.coordinates.longitude <= keralaLongRange[1];
      
      if (!isInKerala) {
        console.warn(`Coordinates for ${place.name} outside Kerala boundaries: [${place.coordinates.latitude}, ${place.coordinates.longitude}]`);
        
        // Try to fix coordinates if they're close to Kerala boundaries
        if (place.coordinates.latitude > 0 && place.coordinates.longitude > 0) {
          // If coordinates are way off but positive, attempt to fix by constraining to Kerala's bounds
          const fixedLat = Math.min(Math.max(place.coordinates.latitude, keralaLatRange[0]), keralaLatRange[1]);
          const fixedLng = Math.min(Math.max(place.coordinates.longitude, keralaLongRange[0]), keralaLongRange[1]);
          
          if (Math.abs(fixedLat - place.coordinates.latitude) < 5 && 
              Math.abs(fixedLng - place.coordinates.longitude) < 5) {
            console.log(`Fixing coordinates for ${place.name}: [${place.coordinates.latitude}, ${place.coordinates.longitude}] -> [${fixedLat}, ${fixedLng}]`);
            place.coordinates.latitude = fixedLat;
            place.coordinates.longitude = fixedLng;
            return true;
          }
        }
        return false;
      }
      
      return true;
    });
    
    console.log(`Got ${validPlaces.length} valid places with coordinates in Kerala`);
    
    // If we have fewer than 8 places, generate some fallback places
    if (validPlaces.length < 8) {
      console.log(`Not enough valid places (${validPlaces.length}), adding fallback destinations`);
      
      // Popular tourist destinations in Kerala with verified coordinates tailored by distance
      const fallbackPlaces = [];
      
      if (tripDays === 1) {
        // Fallbacks for 1-day trips (closer destinations)
        fallbackPlaces.push(
          {
            name: "Vagamon",
            description: `Hill station with meadows and pine forests (${calculateDistance(origin, "Vagamon")} km from ${origin})`,
            coordinates: { latitude: 9.6867, longitude: 76.9344 }
          },
          {
            name: "Illikkal Kallu",
            description: `Popular trekking spot (${calculateDistance(origin, "Illikkal Kallu")} km from ${origin})`,
            coordinates: { latitude: 9.7564, longitude: 76.8422 }
          },
          {
            name: "Thattekad Bird Sanctuary",
            description: `Bird watching paradise (${calculateDistance(origin, "Thattekad")} km from ${origin})`,
            coordinates: { latitude: 10.1017, longitude: 76.7431 }
          },
          {
            name: "Athirappilly Waterfalls",
            description: `Breathtaking waterfall (${calculateDistance(origin, "Athirappilly")} km from ${origin})`,
            coordinates: { latitude: 10.2850, longitude: 76.5696 }
          }
        );
      } else {
        // Fallbacks for 2-day trips (farther destinations)
        fallbackPlaces.push(
          {
            name: "Munnar",
            description: `Hill station and tea gardens (${calculateDistance(origin, "Munnar")} km from ${origin})`,
            coordinates: { latitude: 10.0889, longitude: 77.0595 }
          },
          {
            name: "Thekkady",
            description: `Home to Periyar Wildlife Sanctuary (${calculateDistance(origin, "Thekkady")} km from ${origin})`,
            coordinates: { latitude: 9.5833, longitude: 77.1667 }
          },
          {
            name: "Wayanad",
            description: `Hill district with wildlife and plantations (${calculateDistance(origin, "Wayanad")} km from ${origin})`,
            coordinates: { latitude: 11.6854, longitude: 76.1320 }
          },
          {
            name: "Kovalam Beach",
            description: `Popular beach destination (${calculateDistance(origin, "Kovalam")} km from ${origin})`,
            coordinates: { latitude: 8.4004, longitude: 76.9787 }
          }
        );
      }
      
      // Add distance-appropriate common fallbacks
      fallbackPlaces.push(
        {
          name: "Alleppey Backwaters",
          description: `Famous backwaters and houseboat destination (${calculateDistance(origin, "Alleppey")} km from ${origin})`,
          coordinates: { latitude: 9.4981, longitude: 76.3388 }
        },
        {
          name: "Fort Kochi",
          description: `Historic area with colonial architecture (${calculateDistance(origin, "Kochi")} km from ${origin})`,
          coordinates: { latitude: 9.9658, longitude: 76.2421 }
        },
        {
          name: "Bekal Fort",
          description: `Historic seaside fort (${calculateDistance(origin, "Bekal")} km from ${origin})`,
          coordinates: { latitude: 12.3917, longitude: 75.0327 }
        },
        {
          name: "Kumarakom",
          description: `Peaceful backwater destination (${calculateDistance(origin, "Kumarakom")} km from ${origin})`,
          coordinates: { latitude: 9.6144, longitude: 76.4254 }
        }
      );
      
      // Calculate approximate distance from origin (just for display)
      function calculateDistance(origin, destination) {
        // These are approximate distances - they will be imprecise but useful for display
        const distanceMap = {
          "Munnar": { "Kochi": 130, "Trivandrum": 270, "Kozhikode": 200, "Thrissur": 140 },
          "Alleppey": { "Kochi": 60, "Trivandrum": 160, "Kozhikode": 240, "Thrissur": 120 },
          "Thekkady": { "Kochi": 150, "Trivandrum": 230, "Kozhikode": 260, "Thrissur": 180 },
          "Kovalam": { "Kochi": 220, "Trivandrum": 16, "Kozhikode": 380, "Thrissur": 280 },
          "Wayanad": { "Kochi": 260, "Trivandrum": 420, "Kozhikode": 80, "Thrissur": 190 },
          "Kochi": { "Kochi": 5, "Trivandrum": 210, "Kozhikode": 180, "Thrissur": 70 },
          "Vagamon": { "Kochi": 100, "Trivandrum": 240, "Kozhikode": 230, "Thrissur": 120 },
          "Bekal": { "Kochi": 320, "Trivandrum": 490, "Kozhikode": 150, "Thrissur": 250 },
          "Illikkal Kallu": { "Kochi": 80, "Trivandrum": 175, "Kozhikode": 210, "Thrissur": 95 },
          "Thattekad": { "Kochi": 45, "Trivandrum": 240, "Kozhikode": 220, "Thrissur": 90 },
          "Athirappilly": { "Kochi": 70, "Trivandrum": 270, "Kozhikode": 180, "Thrissur": 60 },
          "Kumarakom": { "Kochi": 65, "Trivandrum": 170, "Kozhikode": 220, "Thrissur": 110 }
        };
        
        // Identify the closest known city to the origin
        const knownOrigins = ["Kochi", "Trivandrum", "Kozhikode", "Thrissur"];
        let closestOrigin = knownOrigins[0];
        let closestOriginMatch = 0;
        
        for (const knownOrigin of knownOrigins) {
          if (origin.toLowerCase().includes(knownOrigin.toLowerCase())) {
            closestOrigin = knownOrigin;
            closestOriginMatch = 100; // Exact match
            break;
          }
          
          // Calculate string similarity (very basic)
          const similarity = knownOrigin.toLowerCase().split('')
            .filter(char => origin.toLowerCase().includes(char)).length / knownOrigin.length;
          
          if (similarity > closestOriginMatch) {
            closestOrigin = knownOrigin;
            closestOriginMatch = similarity;
          }
        }
        
        // Return the distance from the closest known origin to the destination
        const distance = distanceMap[destination]?.[closestOrigin];
        
        // Choose distance appropriate for trip duration
        if (tripDays === 1 && distance && distance > 120) {
          return Math.round(distance * 0.6); // Adjust for 1-day trips (make closer)
        } else if (tripDays === 2 && distance && distance < 100) {
          return Math.round(distance * 1.5); // Adjust for 2-day trips (make farther)
        }
        
        return distance || 100; // Default to 100 if unknown
      }
      
      // Add fallback places that don't duplicate existing places
      for (const fallbackPlace of fallbackPlaces) {
        if (!validPlaces.some(p => p.name.toLowerCase() === fallbackPlace.name.toLowerCase())) {
          validPlaces.push(fallbackPlace);
          if (validPlaces.length >= 10) break; // We have enough places
        }
      }
      
      console.log(`After adding fallbacks, have ${validPlaces.length} places`);
    }
    
    // Apply duplicate detection and removal
    const uniqueValidPlaces = removeDuplicateDestinations(validPlaces);
    
    // Categorize places by distance from description
    const shortDistancePlaces = [];
    const mediumDistancePlaces = [];
    const longDistancePlaces = [];

    uniqueValidPlaces.forEach(place => {
      // Extract distance from description
      const description = place.description.toLowerCase();
      const distanceMatch = description.match(/(\d+(?:\.\d+)?)\s*km/);
      
      if (distanceMatch) {
        const distance = parseFloat(distanceMatch[1]);
        if (distance >= shortDistanceRange.min && distance <= shortDistanceRange.max) {
          shortDistancePlaces.push(place);
        } else if (distance >= mediumDistanceRange.min && distance <= mediumDistanceRange.max) {
          mediumDistancePlaces.push(place);
        } else if (distance >= longDistanceRange.min && distance <= longDistanceRange.max) {
          longDistancePlaces.push(place);
        } else {
          // If distance doesn't fit in defined ranges, categorize based on the trip duration
          if (tripDays === 1) {
            // For 1-day trips, prefer shorter distances
            if (distance <= 60) {
              shortDistancePlaces.push(place);
            } else if (distance <= 100) {
              mediumDistancePlaces.push(place);
            } else {
              longDistancePlaces.push(place);
            }
          } else {
            // For 2-day trips, prefer longer distances
            if (distance <= 100) {
              shortDistancePlaces.push(place);
            } else if (distance <= 250) {
              mediumDistancePlaces.push(place);
            } else {
              longDistancePlaces.push(place);
            }
          }
        }
      } else {
        // If can't determine distance, categorize based on trip duration (default placement)
        if (tripDays === 1) {
          mediumDistancePlaces.push(place); // Default to medium for 1-day
        } else {
          longDistancePlaces.push(place); // Default to long for 2-day
        }
      }
    });
    
    console.log(`Categorized: ${shortDistancePlaces.length} short, ${mediumDistancePlaces.length} medium, ${longDistancePlaces.length} long`);
    
    // Make sure we have enough places in each category to fulfill the client's requirements
    // We need at least 3-4 places in each category to ensure the UI can show a good selection
    
    // Helper function to ensure each category has some minimum number of places
    const ensureMinimumPlaces = (category, otherCategories, minimumCount) => {
      if (category.length >= minimumCount) return;
      
      // Get places from other categories to fill this one
      let placesToAdd = [];
      for (const otherCategory of otherCategories) {
        if (otherCategory.length > minimumCount) {
          // This category has extra places we can use
          const extraPlaces = otherCategory.slice(minimumCount);
          placesToAdd = [...placesToAdd, ...extraPlaces];
          
          // Remove these places from the other category
          otherCategory.length = Math.min(otherCategory.length, minimumCount);
          
          if (category.length + placesToAdd.length >= minimumCount) break;
        }
      }
      
      // Add places to this category
      for (const place of placesToAdd) {
        if (category.length < minimumCount) {
          category.push(place);
        } else {
          break;
        }
      }
    };
    
    // Ensure we have at least 3 places in each category
    const minCategorySize = 3;
    ensureMinimumPlaces(shortDistancePlaces, [mediumDistancePlaces, longDistancePlaces], minCategorySize);
    ensureMinimumPlaces(mediumDistancePlaces, [shortDistancePlaces, longDistancePlaces], minCategorySize);
    ensureMinimumPlaces(longDistancePlaces, [shortDistancePlaces, mediumDistancePlaces], minCategorySize);
    
    console.log(`After balancing: ${shortDistancePlaces.length} short, ${mediumDistancePlaces.length} medium, ${longDistancePlaces.length} long`);
    
    // Return the categories for the client to use
    return {
      shortDistancePlaces: shortDistancePlaces.slice(0, shortCount),
      mediumDistancePlaces: mediumDistancePlaces.slice(0, mediumCount),
      longDistancePlaces: longDistancePlaces.slice(0, longCount)
    };
  } catch (error) {
    console.error("Error in getCozy:", error);
    return { 
      shortDistancePlaces: [], 
      mediumDistancePlaces: [],
      longDistancePlaces: []
    };
  }
}

// FUNCTION 4: For @costfinder.js - Estimates travel costs by car
async function getCost(origin, destination, placesVisiting, numPeople) {
  try {
    const placesString = Array.isArray(placesVisiting) 
      ? placesVisiting.join(", ") 
      : placesVisiting;

    const prompt = `Estimate the cost of a road trip by car from ${origin} to ${destination} for ${numPeople} people, visiting these places along the way: ${placesString}.

Please provide a detailed breakdown including:
1. Fuel costs (estimate distance, average fuel consumption, and current fuel prices)
2. Accommodation costs (assuming mid-range hotels/accommodations)
3. Food and dining expenses (average per person per day)
4. Entrance fees for attractions (estimate based on typical costs)
5. Miscellaneous expenses (parking, tolls, etc.)

Format the response as a JSON object with these categories as properties and both the individual category costs and total trip cost.`;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });
    const response = result.response.candidates[0].content.parts[0].text;
    
    // Try to extract JSON from the response
    try {
      // Look for JSON content between ```json and ``` or just parse the entire text
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || 
                        response.match(/```\n([\s\S]*?)\n```/) || 
                        [null, response];
      
      const jsonContent = jsonMatch[1];
      const costEstimate = JSON.parse(jsonContent);
      return costEstimate;
    } catch (jsonError) {
      console.error("Error parsing JSON from Gemini response:", jsonError);
      
      // Fallback: Create a structured object from the text response
      return {
        totalCost: "Unable to calculate precise cost. Please see details in the response.",
        details: response,
        error: "Could not parse structured cost data"
      };
    }
  } catch (error) {
    console.error("Error in getCost:", error);
    return { 
      error: "Failed to generate cost estimate",
      totalCost: "Unknown",
      details: "An error occurred while generating the cost estimate."
    };
  }
}

function parseGeminiResponse(responseText) {
  const places = [];
  // Clean the response to ensure consistent formatting
  const cleanedResponse = responseText
    .replace(/\*\*/g, '') // Remove any ** formatting
    .replace(/•/g, '-'); // Replace bullet points with dashes if present
  
  const lines = cleanedResponse.split('\n').filter(line => line.trim() !== '');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // Check if line starts with a list marker (-, *, 1., etc.)
    if (line.match(/^[-*\d.]/) || line.match(/^\d+\./)) {
      try {
        // Extract name by looking for the first part before parenthesis or brackets
        let name = '';
        let description = '';
        let coordinates = { latitude: 0, longitude: 0 };
        let coordsFound = false;
        
        // Extract coordinates using regex patterns
        const coordsPattern = /\[(-?\d+\.?\d*),\s*(-?\d+\.?\d*)\]/;
        const coordsMatch = line.match(coordsPattern);
        
        if (coordsMatch) {
          coordinates = {
            latitude: parseFloat(coordsMatch[1]),
            longitude: parseFloat(coordsMatch[2])
          };
          coordsFound = true;
        }
        
        // Extract name and description
        // Pattern 1: Name (Description) [coords]
        const pattern1 = /^[-*\d.\s]*([^([\]]+)\s*\(([^)]+)\)/;
        const match1 = line.match(pattern1);
        
        if (match1) {
          name = match1[1].trim();
          description = match1[2].trim();
            } else {
          // Pattern 2: Name [coords]
          const pattern2 = /^[-*\d.\s]*([^([\]]+)(?=\s*\[)/;
          const match2 = line.match(pattern2);
          
          if (match2) {
            name = match2[1].trim();
            description = "A popular tourist attraction";
          } else {
            // If all else fails, just take the part before any brackets
            name = line.split('[')[0].split('(')[0].trim();
            if (name.startsWith('- ')) name = name.substring(2);
            description = "A popular tourist attraction";
          }
        }
        
        // Only add if we found coordinates and a name
        if (coordsFound && name) {
          places.push({ name, description, coordinates });
        } else {
          console.warn("Missing coordinates or name for line:", line);
        }
      } catch (error) {
        console.error("Error parsing line:", lines[i], error);
      }
    }
  }
  
  // If parsing failed or returned too few places, try a simpler approach
  if (places.length < 3) {
    console.warn("Initial parsing returned too few places, trying simpler approach");
    
    // Just look for names and coordinates with a simpler regex
    const placeRegex = /[-*•]?\s*([^[\]()]+).*?\[(-?\d+\.?\d*),\s*(-?\d+\.?\d*)\]/g;
    let match;
    
    while ((match = placeRegex.exec(cleanedResponse)) !== null) {
      const name = match[1].trim();
      const latitude = parseFloat(match[2]);
      const longitude = parseFloat(match[3]);
      
      if (name && !isNaN(latitude) && !isNaN(longitude)) {
        places.push({
          name,
          description: "A popular tourist attraction",
          coordinates: { latitude, longitude }
        });
      }
    }
  }
  
  console.log(`Successfully parsed ${places.length} places from Gemini response`);
  return places;
}

// FUNCTION 5: For geocoding places that traditional services can't locate
export async function getGeminiGeocode(placeName) {
  try {
    // Ensure the placeName is valid
    if (!placeName || typeof placeName !== 'string') {
      throw new Error("Invalid place name provided");
    }
    
    // Call Gemini API for geocoding
    const prompt = `I need precise geographical coordinates (latitude and longitude) for "${placeName}".
    
This is likely a place in Kerala, India that might be a natural landmark, tourist attraction, or local feature that isn't properly indexed in standard geocoding services.

Respond with ONLY a JSON object in this EXACT format:
{
  "name": "full official name of the place",
  "coordinates": {
    "latitude": numeric latitude value,
    "longitude": numeric longitude value
  },
  "confidence": "high/medium/low"
}

If this is in Kerala, coordinates should be within these ranges:
- Latitude: between 8.2 and 12.8
- Longitude: between 74.8 and 77.8

Be as accurate as possible. For natural landmarks like hills, waterfalls, or lakes, provide coordinates for the main access point or viewing area. Use your knowledge of Kerala geography to provide the most precise location.`;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });
    
    if (!result.response || !result.response.candidates || 
        !result.response.candidates[0] || !result.response.candidates[0].content ||
        !result.response.candidates[0].content.parts || result.response.candidates[0].content.parts.length === 0) {
      throw new Error("Invalid response from Gemini API");
    }
    
    const responseText = result.response.candidates[0].content.parts[0].text;
    
    // Extract the JSON object from the response
    let jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // Try to extract as much as possible if the format isn't perfect
      console.warn("Could not find a proper JSON object in Gemini response, trying to parse manually");
      
      // Look for latitude and longitude in the response
      const latMatch = responseText.match(/latitude["\s:]+(-?\d+\.\d+)/i);
      const lngMatch = responseText.match(/longitude["\s:]+(-?\d+\.\d+)/i);
      
      if (latMatch && lngMatch) {
        const latitude = parseFloat(latMatch[1]);
        const longitude = parseFloat(lngMatch[1]);
        
        return {
          name: placeName,
          coordinates: {
            latitude: latitude,
            longitude: longitude
          },
          confidence: "low" // Mark as low confidence since we had to manually parse
        };
      }
      
      throw new Error("Could not extract coordinates from Gemini response");
    }
    
    try {
      const placeData = JSON.parse(jsonMatch[0]);
      
      // Validate the response
      if (!placeData.coordinates || 
          typeof placeData.coordinates.latitude !== 'number' || 
          typeof placeData.coordinates.longitude !== 'number') {
        throw new Error("Invalid coordinates in Gemini response");
      }
      
      // Check if coordinates are within Kerala's boundaries
      const keralaLatRange = [8.2, 12.8];
      const keralaLongRange = [74.8, 77.8];
      
      const isInKerala = 
        placeData.coordinates.latitude >= keralaLatRange[0] && 
        placeData.coordinates.latitude <= keralaLatRange[1] &&
        placeData.coordinates.longitude >= keralaLongRange[0] &&
        placeData.coordinates.longitude <= keralaLongRange[1];
      
      // If the place is supposedly in Kerala but coordinates are outside Kerala,
      // adjust the confidence level
      if (placeName.toLowerCase().includes("kerala") && !isInKerala) {
        placeData.confidence = "low";
        console.warn(`Warning: Coordinates for "${placeName}" are outside Kerala boundaries`);
      }
      
      console.log(`Gemini geocoded "${placeName}" to:`, placeData);
      
      return {
        name: placeData.name || placeName,
        coordinates: placeData.coordinates,
        confidence: placeData.confidence || "medium"
      };
      
    } catch (parseError) {
      console.error("Error parsing Gemini response:", parseError);
      throw new Error(`Failed to parse Gemini geocoding response: ${parseError.message}`);
    }
  } catch (error) {
    console.error(`Error using Gemini to geocode "${placeName}":`, error);
    throw error;
  }
}

export { getTouristAttractions, getSuggest, getOptions, getCozy, getCost };
