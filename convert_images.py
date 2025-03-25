# take input.json, loop throug the array and check all image strings for " " and replace with "_"

import json

# Open the file
with open('input.json') as f:
    data = json.load(f)

    # Loop through the array
    for i in data:
        # Check all image strings for " " and replace with "_"
        for key in i:
            if key == 'image':
                i[key] = i[key].replace(" ", "_")
                i[key] = i[key].replace(",", "_")
                i[key] = i[key].replace("'", "_")
    
    # Write the new data to a new file
    with open('output.json', 'w') as outfile:
        json.dump(data, outfile, indent=4)

# Close the file
f.close()
print("Done!")