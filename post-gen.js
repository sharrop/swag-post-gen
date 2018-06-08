// Swagger File to Postman Script converter/generator
// See: https://www.npmjs.com/package/swagger2-postman-generator
// Requires NodeJS (and NPM), then "npm install swagger2-postman-generator"
// Payload generator for Swagger: "npm install swagmock"
// See: https://www.npmjs.com/package/swagmock

var Swagger2Postman = require("swagger2-postman-generator");
// var Swagmock = require("swagmock");
const fs = require('fs');

// Need to fix the association for: Content-Type = application/json
var headersTest = "pm.test('Content-Type is present', function() { pm.response.to.have.header('Content-Type') });\npm.test('Content-Type is application/json', function() { pm.response.headers.has('application/json') });\n"
var postTest = "pm.test('Successful POST request', function() { pm.expect(pm.response.code).to.be.oneOf([201,202]) });";
var getTest = "pm.test('Response code to good GET request', function() { pm.expect(pm.response.code).to.be.oneOf([200,206]) });\npm.test('GET response has valid JSON body', function() { pm.response.to.have.jsonBody() });\n\n\/\/ Parse the JSON response\nvar jsonData = pm.response.json();";
var patchTest = "pm.test('Successful PATCH request', function() { pm.expect(pm.response.code).to.be.oneOf([200,202,204]); })\npm.test('GET response has valid JSON body', function() { pm.response.to.have.jsonBody() });\n\n\/\/ Parse the JSON response\nvar jsonData = pm.response.json();";
var putTest = "pm.test('Successful PUT request', function() {\n  pm.expect(pm.response.code).to.be.oneOf([200,202,204]);\n});";
var deleteTest = "pm.test('Successful DELETE request', function() {\n  pm.expect(pm.response.code).to.be.oneOf([200,202,204]);\n});";

function addPayload(req, spec) {
    var payload = "";
    // mock = Swagmock(spec);

    // Strip the basePath from the URL:
    var apiPath = spec.basePath;
    var pathStart = req.url.indexOf(apiPath) + apiPath.length - 1;
    // Strip the pretext before the "/path/starts"
    urlPath = req.url.substr(pathStart);
    payload = "// Sample payload for [" +urlPath+ "]";

    /*
    mock.responses({
        path: urlPath,
        operation: 'post',
        response: 200
    }).then(mockResponse => {
        console.log("Adding payload [" +mockResponse+ "]")
        payload += mockResponse;
    }).catch(error => {
        console.log("Something went wrong in mocking the POST for :" +urlPath + "\n: " +error)
    })
    */

    return payload;
}
  
function testAttributes(req, spec) {
  var test = "\n";
  // Sure there is a neater one-step RegExp/Replace to achieve this, but extracting
  // the leaf-resource from the request-url - being the last segment of the path
  resourceList = req.url.split('/');
  resource = resourceList[resourceList.length-1];
  // Strip any arg-lists starting with '?' from the end of the resource and up-case for later comparison
  resource = resource.replace(/\?.*/, '').toUpperCase();

  for (definition in spec.definitions) {

    if (definition.toUpperCase() === resource) {

        // Check if there are any mandatory attributes in the spec to test for in the response
        if (spec.definitions[definition].hasOwnProperty("required")) {
            var requiredAttributes = spec.definitions[definition]["required"];

            test += "\n    // Mandatory attributes listed in \"definitions." +definition+ ".required\" are [" +requiredAttributes+ "]";
            test += "\n    var requiredAttributes = [ '" +requiredAttributes.join("', '")+ "' ];"
            test += "\n    pm.test('Instance ' +index+ ' has all mandatory attributes', function() { pm.expect(Object.keys(instance)).to.include.members(requiredAttributes) } );";
          } else {
            // No mandatory attributes in the spec definition to test for in the response
            test += "\n    // definitions." +definition+ " does not have a \'required\' attribute - so no mandatory attributes to be tested" 
        }
        
        test += "\n\n    // Checking all remaining possible attributes for " +definition+ ", taken from the Swagger file"
        for (specAttrs in spec.definitions[definition].properties) {
            propertyRef = spec.definitions[definition].properties[specAttrs];
            label = ((specAttrs.indexOf("@") == -1) ? "."+specAttrs : "[\'"+ specAttrs+ "\']")
            test += "\n    pm.test(\'Response has " +specAttrs+ " attribute\', function() { pm.expect(instance" +label+ ")";
            if (propertyRef.hasOwnProperty("type")) {
                // Capitalise the first letter of the type (so 'array' => 'Array')
                specType = propertyRef.type;
                expectedType = specType.charAt(0).toUpperCase() + specType.slice(1);
                test += ".to.be.an.instanceOf(" +expectedType+ ");";
            }
            test +=  " });"
        }
      }
  }

  return test;
}

// Swagger2Postman.convertSwagger()
//      .from { URL() | File() | Json() }
//      .to{ PostmanCollectionJson() | PostmanCollectionFile() | PostmanCollection() | PostmanCollectionPost(URL)}
 
// Import Swagger URL
// var swaggerFile = "https://raw.githubusercontent.com/tmforum-apis/TMF641_ServiceOrder/master/Service_Ordering_Management.regular.swagger.json"
// var swaggerFile = "Service_Ordering_Management_regular_swagger.json"
var swaggerFile = "Party_Management.regular.swagger.json"
//var swaggerFile = "Trouble_Ticket.swagger.json"

var collection = Swagger2Postman
    .convertSwagger()
//  .fromUrl(swaggerFile)
    .fromFile(swaggerFile)
    .toPostmanCollection({
        requestPreProcessor: (postmanRequest, swaggerSpec) => {
            payloadText = "// Auto-generated sample payload";

            if (postmanRequest.method.includes("POST")) {
                payloadText += addPayload(postmanRequest, swaggerSpec);
            }
            /* else if (postmanRequest.method.includes("PATCH")) {
                testText += patchPayload;
            } else if (postmanRequest.method.includes("PUT")) {
                testText += putPayload;
            } */
            postmanRequest.rawModeData  = payloadText;
        }, 
        requestPostProcessor: (postmanRequest, swaggerSpec) => {
                // postmanRequest - request object from postman collection
            // swaggerSpec - Swagger spec object used to generate postman collection
            testText = "// See: https://www.getpostman.com/docs/v6/postman/scripts/postman_sandbox_api_reference";
            testText += "\n// Testing "+postmanRequest.method+" method on " +postmanRequest.url+ "\n\n";
            testText += headersTest;

            if (postmanRequest.method.includes("POST")) {
                testText += postTest;
            } else if (postmanRequest.method.includes("GET")) {
                testText += getTest;
            } else if (postmanRequest.method.includes("PATCH")) {
                testText += patchTest;
            } else if (postmanRequest.method.includes("PUT")) {
                testText += putTest;
            } else if (postmanRequest.method.includes("DELETE")) {
                testText += deleteTest;
            }
            testText += "\n// TODO: jsonData might be an array of resources - need to detect and iterate if so\n"
            testText += "\nif (Array.isArray(jsonData) && (jsonData.length > 0)) {\n  jsonData.forEach(function(instance, index) {"
            
            testText += testAttributes(postmanRequest, swaggerSpec);

            // If a pathVariable was used in the request, it should be tested for in the response 
            for (variable in postmanRequest.pathVariables) {
                testText += "\n\n// This request was made with an attribute of [" +variable+ "] so we should at least find that in the response";
                testText += "\npm.test('Response contains [" +variable+ "] attribute', function() { pm.expect(pm.response.json()." +variable+") });";
            }
            testText += "\n  });\n}";
            postmanRequest.tests = testText;
        }
    })

pmObj = JSON.stringify(collection, null, 4)
console.log(pmObj)

fs.writeFile("pm-" +swaggerFile, pmObj, 'utf8', function (err) {
    if (err) {
        return console.log(err);
    }

    console.log("The file was saved!");
}); 