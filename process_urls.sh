#!/bin/bash

# Specify the input file containing a list of URLs
url_file="url_list.txt"

# Specify the string to find and the replacement string
find_string="src:\"https://framerusercontent.com/images/"
replace_string="src:new URL(\"assets/new_string"

find_other_string=".webp\"}}"
replace_other_string=".webp\", \"https://framerusercontent.com/\").href}}"

final_find_string="assets/new_string"
final_replace_string="assets/"

# Create a directory to store downloaded files
output_directory="${PWD}/src/app/framer"
mkdir -p "$output_directory"

echo $output_directory

# Loop through the URLs in the input file
while read -r url; do
  # Generate a filename from the URL (you can use a more complex logic if needed)
  filename="${output_directory}/$(echo $url | sed "s_^https://framer.com/m/\(.*\)\@.*_\1_")"

  # Download the file using wget
  wget -q -O "$filename" "$url"

  # Check if the download was successful
  if [ $? -eq 0 ]; then
    # Use sed to replace the string in the downloaded file
    sed -i "s@$find_string@$replace_string@g" "$filename"
    sed -i "s@$find_other_string@$replace_other_string@g" "$filename"
    sed -i "s@$final_find_string@$final_replace_string@g" "$filename"
    echo "Processed: $filename"
  else
    echo "Failed to download: $url"
  fi
done < "$url_file"

# Cleanup: remove the downloaded files if needed
# rm -r "$output_directory"
