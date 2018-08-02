/*******************************************************************************************************
** Filename: crawler.js
** Author: William Ryan Brooks
** Date: 2018-08-01
** Description: Web scraper for Amazon.com. Navigates to Books category and collects product details
** on available books.
** Credit: Basic instructions for getting started with a web scraper found at
** http://www.netinstructions.com/how-to-make-a-simple-web-crawler-in-javascript-and-node-js/
*******************************************************************************************************/

// Require node modules
var request = require('request');
var cheerio = require('cheerio');
var URL = require('url-parse');
var he = require('he');
var fs = require('fs');

var startURL = "http://www.amazon.com";
var MAX_PAGES_TO_VISIT = 14;

var pagesVisited = {};
var numPagesVisited = 0;
var numLinks = 0;
var numProducts = 0;
var pagesToVisit = [];
var url = new URL(startURL);
var baseUrl = url.protocol + "//" + url.hostname;

// Array to hold product objects
var products = [];

// Start crawl process
pagesToVisit.push(startURL);
crawl();

// Recursive function for initiating crawl
function crawl() {
    
    // Done with crawl
    if (numPagesVisited >= MAX_PAGES_TO_VISIT) {
        console.log("Reached maximum number of pages to visit.");

        // Output products to JSON file
        fs.writeFile("./products.json", JSON.stringify(products, null, 2), (err) => {
            if (err) {
                console.error(err);
                return;
            }
            console.log("JSON file created.");   
        });
       
        return;
    }
  
    // Get next link
    var nextPage = pagesToVisit.pop();

    // Check for duplicate links
    if (nextPage in pagesVisited) { 
        crawl();
    } 
    else { 
        visitPage(nextPage, crawl);
    }
}

// Function to get product details from page if applicable
function visitPage(url, callback) {

    // Add page to set
    pagesVisited[url] = true;
    numPagesVisited++;

    // Make request
    console.log("Visiting page " + url);

    request(url, function(error, response, body) {

        // Check status code 
        if (response.statusCode !== 200) {
            callback();
            return;
        }

        // Load document body
        var $ = cheerio.load(body);
        
        // At this point, all links are product links. Here, we get the product details.
        if (numPagesVisited > 3) {

            var bookDetails = {};

            // Product ID
            bookDetails['id'] = numProducts;
            numProducts++;

            // Get book description
            var description = $('#bookDescription_feature_div').children('noscript').text();

            // Remove HTML tags
            description = description.replace(/<(?:.|\n)*?>|\n/gm, '').trim();   

            // Remove unicode characters 
            description = he.decode(description);

            // Use first 250 characters
            bookDetails['description'] = (description.slice(0, 250)).concat('...'); 

            // Book product URL
            bookDetails['sourceURL'] = url;
    
            // Hardcover
            if ($('#title > span.a-size-medium').text().indexOf("Hardcover") !== -1) {
                bookDetails['name'] = $('#productTitle').text();
                bookDetails['type'] = "Hardcover";
                bookDetails['listPrice'] = $('div.inlineBlock-display > span.a-color-price').text(); 

                getProductDetails($, bookDetails);
                getProductImages($, bookDetails);
            }

            // Paperback
            else if ($('#title > span.a-size-medium').text().indexOf("Paperback") !== -1) {
                bookDetails['name'] = $('#productTitle').text();
                bookDetails['type'] = "Paperback";
                bookDetails['listPrice'] = $('div.inlineBlock-display > span.a-color-price').text();   

                getProductDetails($, bookDetails);
                getProductImages($, bookDetails);
            }

            // Ebook
            else if ($('#title > span.a-size-large').text().indexOf("Kindle Edition") !== -1) {
                bookDetails['name'] = $('#ebooksProductTitle').text(); 
                bookDetails['type'] = "Ebook";
                bookDetails['listPrice'] = $('input[name=displayedPrice]').val();

                getProductImages($, bookDetails); 
            }

            // Audiobook
            if ($('#title > span.a-size-medium').text().indexOf("Audible Audiobook") !== -1) {
                bookDetails['name'] = $('#productTitle').text();
                bookDetails['type'] = "Audiobook";
                bookDetails['listPrice'] = $('span.a-color-base > span.a-color-price').text();  

                getProductImages($, bookDetails);
            }

            // Board book
            if ($('#title > span.a-size-medium').text().indexOf("Board book") !== -1) {
                bookDetails['name'] = $('#productTitle').text();
                bookDetails['type'] = "Board book";
                bookDetails['listPrice'] = $('div.inlineBlock-display > span.a-color-price').text();  

                getProductDetails($, bookDetails);  
                getProductImages($, bookDetails);
            }
 
            products.push(bookDetails); 

            // Calls crawl() function
            callback();  
        } 
               
        else {
            getPageLinks($); 
            callback();
        }

    });
}



// Function to get all relative links on page
function getPageLinks($) {

    var links = $("a[href^='/']");

    links.each(function() {

        // Site directory path
        var directory = 'gp/site-directory';
        var dirFound = 0;

        // Category path (We want the Books category. Can be changed to match any other category).
        var category = 'books-used-books-textbooks';

        // Product paths
        var product = ['gp/product/B0', 'gp/product/1', 'gp/product/0']; 

        // Check if starting URL
        if (numPagesVisited === 1) {

            // Find site directory from list of links on homepage
            if ($(this).attr('href').indexOf(directory) !== -1 && dirFound !== 1) {
                pagesToVisit.push(baseUrl + $(this).attr('href'));
                dirFound = 1;
            }           
        }

        // Check if second link (site directory)
        else if (numPagesVisited === 2) {
           
            // Find category  
            if ($(this).attr('href').indexOf(category) !== -1) {
                pagesToVisit.push(baseUrl + $(this).attr('href'));
            }
        }

        // Check if third link (category page). This is where we gather the product links.
        else if (numPagesVisited === 3) {  

            // Keep track of number of ebooks so there is more variation in book types
            var addLink = true;
            if ($(this).attr('href').indexOf(product[0]) !== -1) {    
                // Only add 3 out of every 5 ebook links
                var rand = Math.floor((Math.random() * 5) + 1);   
                if (rand === 2 || rand == 3) { 
                    addLink = false;
                } 
            } 
            
            // Find links that match product path
            var MAX_LINKS = 50;
            if (($(this).attr('href').indexOf(product[0]) !== -1 || $(this).attr('href').indexOf(product[1]) !== -1 || $(this).attr('href').indexOf(product[2]) !== -1) && (numLinks < MAX_LINKS && addLink)) {  
                pagesToVisit.push(baseUrl + $(this).attr('href')); 
                numLinks++;
            }
        }       
    });
}


// Get dimensions and weight of hardcover and paperback books
function getProductDetails($, bookDetails) {
    $('#productDetailsTable li').each(function() {
        if ($(this).text().indexOf("Product Dimensions:") !== -1) {
            bookDetails['product_dimension'] = $(this).text().match(/(\d*\.?\d*) x (\d*\.?\d*) x (\d*\.?\d*) ([a-z]*)/)[0];   
        }

        else if ($(this).text().indexOf("Shipping Weight:") !== -1) {
            bookDetails['weight'] = $(this).text().match(/(\d*\.?\d*) ([a-z]* )/)[0].trim();
        }
    });
}

// Get image links for product
function getProductImages($, bookDetails) {
  
    bookDetails['imageURL'] = [];

    if ($('#imgThumbs').length) {
        $('#imgThumbs img').each(function() {
            bookDetails['imageURL'].push($(this).attr('src'));
        });
    }

    else if ($('#ebooksImgBlkFront').length) {
        bookDetails['imageURL'].push($('#ebooksImgBlkFront').attr('src'));
    }       
 
    else if ($('#main-image').length) {
        bookDetails['imageURL'].push($('#main-image').attr('src'));
    }
}

