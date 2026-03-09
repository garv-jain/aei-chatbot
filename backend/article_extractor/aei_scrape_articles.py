import os
import re
import requests
from bs4 import BeautifulSoup
from readability import Document
import certifi
import urllib3
import sys

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

def get_scholar_name():
    """Get scholar name from command line argument or user input"""
    if len(sys.argv) > 1:
        return ' '.join(sys.argv[1:])
    else:
        return input("Enter the scholar's name: ").strip()

def url_to_filename(url):
    url = url.replace('https://', '').replace('http://', '').rstrip('/')
    filename = re.sub(r'[^A-Za-z0-9]+', '_', url)
    filename = filename[:200]
    return f"{filename}.txt"

def get_existing_articles(output_dir):
    """Get set of existing article filenames"""
    existing_files = set()
    if os.path.exists(output_dir):
        existing_files = set(os.listdir(output_dir))
        print(f"Found {len(existing_files)} existing article files")
    else:
        print("No existing articles directory found")
    return existing_files

def main():
    scholar_name = get_scholar_name()
    
    if not scholar_name:
        print("No scholar name provided. Exiting.")
        return
    
    # Create safe folder name version of scholar name
    safe_name = re.sub(r'[^A-Za-z0-9]+', '_', scholar_name)
    
    # Update file paths to use scholar folder
    scholar_folder = safe_name
    urls_file = os.path.join('backend', 'article_extractor', 'article_links', scholar_folder, 'aei_urls_only.txt')
    output_dir = os.path.join('backend', 'knowledge_base', scholar_folder)

    # Check if URLs file exists
    if not os.path.exists(urls_file):
        print(f"URLs file not found: {urls_file}")
        print("Please run the link extractor first to generate the URLs file.")
        return

    os.makedirs(output_dir, exist_ok=True)

    # Get existing article files
    existing_files = get_existing_articles(output_dir)

    with open(urls_file, 'r') as f:
        urls = [line.strip() for line in f if line.strip()]

    print(f"Processing {len(urls)} URLs for {scholar_name}")
    print(f"Saving articles to: {output_dir}")

    processed_count = 0
    skipped_count = 0
    failed_count = 0
    new_articles_count = 0

    for i, url in enumerate(urls, 1):
        filename = url_to_filename(url)
        output_path = os.path.join(output_dir, filename)
        
        # Skip if file already exists
        if filename in existing_files:
            print(f"[{i}/{len(urls)}] Skipping (already exists): {filename}")
            skipped_count += 1
            continue
        
        try:
            print(f"[{i}/{len(urls)}] Processing: {url}")
            response = requests.get(url, timeout=15, verify=False)
            response.raise_for_status()
            doc = Document(response.text)
            title = doc.title()
            summary_html = doc.summary()
            soup = BeautifulSoup(summary_html, 'html.parser')
            text = soup.get_text(separator='\n', strip=True)
            
            with open(output_path, 'w', encoding='utf-8') as out_f:
                out_f.write(f"PAGE_TITLE: \n\t{title}\n\n{text}")
            print(f"[{i}/{len(urls)}] Saved: {filename}")
            new_articles_count += 1
            processed_count += 1
        except Exception as e:
            print(f"[{i}/{len(urls)}] Failed to process {url}: {e}")
            failed_count += 1

    # Summary
    print(f"\n=== Processing Summary ===")
    print(f"Total URLs: {len(urls)}")
    print(f"New articles saved: {new_articles_count}")
    print(f"Skipped (already existed): {skipped_count}")
    print(f"Failed to process: {failed_count}")
    print(f"Success rate: {((new_articles_count)/(len(urls)-skipped_count)*100):.1f}%" if (len(urls)-skipped_count) > 0 else "N/A")

if __name__ == "__main__":
    main()