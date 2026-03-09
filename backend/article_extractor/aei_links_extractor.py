import requests
from bs4 import BeautifulSoup
import time
import csv
from urllib.parse import urljoin, urlparse
import re
import ssl
import urllib3
import sys
import os

# Disable SSL warnings
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

def get_scholar_name():
    """Get scholar name from command line argument or user input"""
    if len(sys.argv) > 1:
        return ' '.join(sys.argv[1:])
    else:
        return input("Enter the scholar's name: ").strip()

def load_existing_urls(output_dir):
    """Load existing URLs from the URLs file if it exists"""
    urls_file = os.path.join(output_dir, 'aei_urls_only.txt')
    existing_urls = set()
    
    if os.path.exists(urls_file):
        with open(urls_file, 'r', encoding='utf-8') as f:
            existing_urls = set(line.strip() for line in f if line.strip())
        print(f"Found {len(existing_urls)} existing URLs in {urls_file}")
    else:
        print("No existing URLs file found. Starting fresh.")
    
    return existing_urls

def extract_links_from_page(page_num, scholar_name):
    """Extract all relevant links from a single search results page"""
    
    base_url = "https://www.aei.org/search-results/"
    params = {
        'wpsolr_fq[0]': f'scholars_str:{scholar_name}',
        'wpsolr_page': str(page_num)
    }
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    
    try:
        print(f"Fetching page {page_num}...")
        # Add SSL verification bypass and timeout
        response = requests.get(base_url, params=params, headers=headers, 
                              verify=False, timeout=30)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Look for links specifically within elements with class "post post-search"
        links = []
        
        # Find all elements with class "post post-search"
        post_elements = soup.find_all(class_="post post-search")
        print(f"Found {len(post_elements)} post elements on page {page_num}")
        
        for post in post_elements:
            # Find the main/primary link for this post
            # Try different strategies to find the main article link
            main_link = None
            
            # Strategy 1: Look for title link (h1, h2, h3, etc. containing a link)
            title_elem = post.find(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])
            if title_elem:
                title_link = title_elem.find('a', href=True)
                if title_link:
                    main_link = title_link
            
            # Strategy 2: If no title link, find the first content link (not social/share links)
            if not main_link:
                post_links = post.find_all('a', href=True)
                for link in post_links:
                    href = link.get('href')
                    if href and 'aei.org' in urljoin(base_url, href):
                        full_test_url = urljoin(base_url, href)
                        # Make sure it's a content link, not a share/social link
                        if (full_test_url.startswith('https://www.aei.org/') and
                            not any(exclude in full_test_url.lower() for exclude in [
                                'search-results', 'wp-content', 'wp-admin', 'feed',
                                'twitter.com', 'facebook.com', 'linkedin.com',
                                'mailto:', 'javascript:', '#', 'share', 'print'
                            ])):
                            main_link = link
                            break
            
            # If we found a main link, process it
            if main_link:
                href = main_link.get('href')
                full_url = urljoin(base_url, href)
                
                # Get link text and post title
                link_text = main_link.get_text(strip=True)
                post_title_elem = post.find(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])
                post_title = post_title_elem.get_text(strip=True) if post_title_elem else "No title found"
                
                links.append({
                    'url': full_url,
                    'link_text': link_text[:100] + ('...' if len(link_text) > 100 else ''),
                    'post_title': post_title[:150] + ('...' if len(post_title) > 150 else ''),
                    'page': page_num
                })
            else:
                print(f"Warning: Could not find main link for a post on page {page_num}")
        
        # Remove duplicates while preserving order
        seen = set()
        unique_links = []
        for link in links:
            if link['url'] not in seen:
                seen.add(link['url'])
                unique_links.append(link)
        
        print(f"Found {len(unique_links)} unique links on page {page_num}")
        return unique_links
        
    except requests.RequestException as e:
        print(f"Error fetching page {page_num}: {e}")
        return []
    except Exception as e:
        print(f"Error processing page {page_num}: {e}")
        return []

def extract_all_links(scholar_name, existing_urls):
    """Extract links from all available pages dynamically, skipping existing ones"""
    all_links = []
    new_links_count = 0
    page_num = 1
    
    while True:
        print(f"Processing page {page_num}...")
        page_links = extract_links_from_page(page_num, scholar_name)
        
        # If no links found, we've likely reached the end
        if not page_links:
            print(f"No links found on page {page_num}. Stopping extraction.")
            break
        
        # Filter out existing URLs
        new_page_links = []
        for link in page_links:
            if link['url'] not in existing_urls:
                new_page_links.append(link)
                new_links_count += 1
            else:
                print(f"Skipping existing URL: {link['url'][:80]}...")
        
        all_links.extend(new_page_links)
        print(f"Found {len(new_page_links)} new links on page {page_num}")
        
        # Be respectful to the server - increase delay
        time.sleep(2)
        
        # Progress update every 5 pages
        if page_num % 5 == 0:
            print(f"Completed {page_num} pages so far... ({new_links_count} new links)")
        
        page_num += 1
    
    print(f"Total pages processed: {page_num - 1}")
    
    # Remove any remaining duplicates across all pages
    seen_urls = set()
    unique_all_links = []
    for link in all_links:
        if link['url'] not in seen_urls:
            seen_urls.add(link['url'])
            unique_all_links.append(link)
    
    print(f"Total new unique links extracted: {len(unique_all_links)}")
    return unique_all_links

def append_links_to_file(new_links, output_dir):
    """Append new links to the CSV file"""
    filepath = os.path.join(output_dir, 'aei_links.csv')
    file_exists = os.path.exists(filepath)
    
    with open(filepath, 'a', newline='', encoding='utf-8') as csvfile:
        fieldnames = ['url', 'link_text', 'post_title', 'page']
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        
        # Write header only if file doesn't exist
        if not file_exists:
            writer.writeheader()
        
        for link in new_links:
            writer.writerow(link)
    
    action = "Updated" if file_exists else "Created"
    print(f"{action} links file: {filepath} (added {len(new_links)} new links)")

def append_urls_only(new_links, output_dir):
    """Append new URLs to the text file"""
    filepath = os.path.join(output_dir, 'aei_urls_only.txt')
    
    with open(filepath, 'a', encoding='utf-8') as f:
        for link in new_links:
            f.write(link['url'] + '\n')
    
    action = "Updated" if os.path.exists(filepath) else "Created"
    print(f"{action} URLs file: {filepath} (added {len(new_links)} new URLs)")

def main():
    scholar_name = get_scholar_name()
    
    if not scholar_name:
        print("No scholar name provided. Exiting.")
        return
    
    # Create output directory named after the scholar
    safe_name = re.sub(r'[^A-Za-z0-9]+', '_', scholar_name)
    output_dir = os.path.join('backend', 'article_extractor', 'article_links', safe_name)
    os.makedirs(output_dir, exist_ok=True)
    
    print(f"Starting extraction of {scholar_name} links from AEI...")
    print(f"Files will be saved to folder: {output_dir}")
    
    # Load existing URLs to avoid duplicates
    existing_urls = load_existing_urls(output_dir)
    
    print("This will fetch all pages of search results.\n")
    
    # Extract all links, skipping existing ones
    new_links = extract_all_links(scholar_name, existing_urls)
    
    print(f"\nExtraction complete!")
    print(f"Total new unique links found: {len(new_links)}")
    
    if new_links:
        # Append to files in the scholar's folder
        append_links_to_file(new_links, output_dir)
        append_urls_only(new_links, output_dir)
        
        # Display sample of results
        print("\nSample of new extracted links:")
        for i, link in enumerate(new_links[:10]):
            print(f"{i+1}. {link['url']}")
            print(f"   Link text: {link['link_text']}")
            print(f"   Post title: {link['post_title']}")
            print(f"   From page: {link['page']}\n")
        
        if len(new_links) > 10:
            print(f"... and {len(new_links) - 10} more new links")
    
    else:
        print("No new links were found. All links may already be in the existing files.")

if __name__ == "__main__":
    main()