import { useState } from 'react'
import './index.css'

// Your free key from https://www.thedogapi.com/
// Put it in a .env file at the project root as:  VITE_APP_ACCESS_KEY=your_key_here
const ACCESS_KEY = import.meta.env.VITE_APP_ACCESS_KEY;

// turn "Stubborn, Curious, Playful" into ["Stubborn", "Curious", "Playful"]
const parseTraits = (temperament) =>
  temperament ? temperament.split(",").map((t) => t.trim()).filter(Boolean) : [];

console.log("key loaded?", ACCESS_KEY);

function App() {
  // the dog currently shown in the middle column
  const [currentBreed, setCurrentBreed] = useState(null);

  // every dog we've discovered so far (powers the "Breeds You've Viewed" column)
  const [history, setHistory] = useState([]);

  // the ban list — each entry looks like { type: "Breed Group", value: "Toy" }
  const [banList, setBanList] = useState([]);

  // little flag so we can show "Fetching..." while we wait on the API
  const [loading, setLoading] = useState(false);

  console.log("key length:", ACCESS_KEY?.length, JSON.stringify(ACCESS_KEY));


  // count how many times we've seen each breed, e.g. { "Akita": 2, "Boxer": 1 }
  const breedCounts = history.reduce((counts, breed) => {
    counts[breed.name] = (counts[breed.name] || 0) + 1;
    return counts;
  }, {});

  // returns true if a breed breaks any rule currently on the ban list
  const isBanned = (breed) => {
    for (const ban of banList) {
      if (ban.type === "Breed Group" && breed.breed_group === ban.value) return true;
      if (ban.type === "Origin" && breed.origin === ban.value) return true;
      if (ban.type === "Temperament" && parseTraits(breed.temperament).includes(ban.value)) return true;
    }
    return false;
  };

  // ask the Dog API for one random dog that has breed info attached
  const fetchDog = async () => {
    const query = `https://api.thedogapi.com/v1/images/search?has_breeds=true&size=med`;

    // The Dog API wants the key in an "x-api-key" HEADER, not in the URL.
    // Only send the header if we actually have a key.
    const options = ACCESS_KEY ? { headers: { "x-api-key": ACCESS_KEY } } : {};

    const response = await fetch(query, options);
    const json = await response.json();

    // if the key is wrong (or the API errors) we get back an object, not an array
    if (!Array.isArray(json)) {
      console.error("Dog API did not return a list:", json);
      return null;
    }
    return json[0]; // the API hands back an array containing one image
  };

  // the Discover! button — keep fetching until we land on a breed that isn't banned
  const discover = async () => {
    setLoading(true);
    try {
      let attempts = 0;
      let dog = null;
      let breed = null;
      let sawAnyBreed = false; // did the API give us ANY valid dog at all?

      // try up to 20 times to dodge anything on the ban list
      while (attempts < 20) {
        dog = await fetchDog();
        breed = dog && dog.breeds ? dog.breeds[0] : null;

        if (breed) sawAnyBreed = true;
        if (breed && !isBanned(breed)) {
          break; // found a good one!
        }
        breed = null;
        attempts++;
      }

      if (!breed && !sawAnyBreed) {
        // we never got a single dog back -> it's the API/key, not the ban list
        alert("Couldn't reach the Dog API. Double-check your key and try again. (See the console for details.)");
      } else if (!breed) {
        alert("Hard to find a pup that fits your ban list! Try removing a few bans.");
      } else {
        // bundle the breed info together with its image url
        const result = { ...breed, image: dog.url };
        setCurrentBreed(result);
        setHistory((prev) => [...prev, result]);
      }
    } catch (error) {
      console.error(error);
      alert("Oops! Something went wrong with that query, let's try again!");
    }
    setLoading(false);
  };

  // clicking an attribute toggles it on/off the ban list
  const toggleBan = (type, value) => {
    if (!value) return; // ignore empty attributes

    const alreadyBanned = banList.find((b) => b.type === type && b.value === value);

    if (alreadyBanned) {
      // it's already on the list -> remove it
      setBanList(banList.filter((b) => !(b.type === type && b.value === value)));
    } else {
      // it's not on the list -> add it
      setBanList([...banList, { type, value }]);
    }
  };

  // small helper to show a single clickable attribute (or "Unknown" if empty)
  const showAttribute = (type, value) => {
    if (!value) {
      return <p>{type}: <span className="unknown">Unknown</span></p>;
    }
    return (
      <p>
        {type}:{" "}
        <span className="attribute" onClick={() => toggleBan(type, value)}>
          {value}
        </span>
      </p>
    );
  };

  return (
    <div className="App">

      {/* LEFT: breeds we've already seen */}
      <div className="repository">
        <h2>Breeds You've Viewed</h2>
        {history.length === 0 ? (
          <p>Hit Discover to start your journey!</p>
        ) : (
          <ul className="history-list">
            {Object.entries(breedCounts).map(([name, count], index) => (
              <li key={index}>
                {name} {count > 1 && <span className="count">(seen {count}x)</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* MIDDLE: the discover button + current dog */}
      <div className="discover">
        <h1>Pupalooza</h1>
        <p>Discover new dog breeds!</p>
        <br />
        <button className="button" onClick={discover} disabled={loading}>
          {loading ? "Fetching..." : "Discover!"}
        </button>

        {currentBreed ? (
          <div className="breed-card">
            <img className="dog-image" src={currentBreed.image} alt={currentBreed.name} />
            <h2>{currentBreed.name}</h2>

            {showAttribute("Breed Group", currentBreed.breed_group)}
            {showAttribute("Origin", currentBreed.origin)}
            <p>Life Span: {currentBreed.life_span || "Unknown"}</p>

            {currentBreed.temperament && (
              <div className="temperament">
                <p>Temperament:</p>
                <div className="tag-container">
                  {parseTraits(currentBreed.temperament).map((trait, index) => (
                    <span
                      key={index}
                      className="attribute tag"
                      onClick={() => toggleBan("Temperament", trait)}
                    >
                      {trait}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <p className="hint">Click any highlighted attribute to ban it →</p>
          </div>
        ) : (
          <div className="breed-card empty">
            <h3>No pup yet — click Discover!</h3>
          </div>
        )}
      </div>

      {/* RIGHT: the ban list */}
      <div className="ban-list">
        <h2>Ban List</h2>
        <h3>Select an attribute in your listing to ban it from future discoveries.</h3>
        {banList.length === 0 ? (
          <p>Nothing banned yet.</p>
        ) : (
          <div className="tag-container">
            {banList.map((ban, index) => (
              <span
                key={index}
                className="banned-tag"
                onClick={() => toggleBan(ban.type, ban.value)}
                title={ban.type}
              >
                {ban.value} ✕
              </span>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}

export default App
