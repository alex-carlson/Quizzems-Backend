import json
import urllib.parse

def convert_json(input_file, output_file):
    # Load the input JSON data from the file
    with open(input_file, 'r') as infile:
        data = json.load(infile)
    
    # Process the data to convert each "image" URL
    result = []
    for item in data:
        image_url = item.get("image", "")
        # Ensure the URL is properly encoded
        if image_url:
            encoded_url = urllib.parse.quote(image_url)
            result.append({"image": encoded_url, "answer": item.get("answer")})
    
    # Write the result to the output JSON file
    with open(output_file, 'w') as outfile:
        json.dump(result, outfile, indent=4)

# Example usage
input_file = 'input.json'  # Path to your input JSON file
output_file = 'output.json'  # Path to save the output JSON file
convert_json(input_file, output_file)

print(f"Conversion complete! Output saved to {output_file}")
