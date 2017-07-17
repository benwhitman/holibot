My submission for the Chatbot competition is a service which allows users of the popular annual leave booking system TimeTastic
to interact with it's API using Slack.

The goals of the project were to be able to allow users to quickly see how much time off they had for the year etc., and to request
new holidays.

I had to choose between hosting this service myself or allowing users to deploy it to their own AWS account. I went for the latter,
because accessing TimeTastic requires an API token and I didn't want to have to store these tokens in my own infrastructure.
However, this makes deploying the bot much more complicated. I like a challenge though, and have found a way to deploy all the necessary
objects to AWS from a Node.js script.

Functionality

Holibot provides the following intents
* CheckAllowance *"How many days holiday do I have?"*
* CheckMyHolidays *"What holidays do I have booked?"*
* RequestTimeOff *"I need a holiday from Tuesday to 13th August"*
* CheckApprovals *"What approvals are outstanding?"*
* Approve *"Approve all [Alice's|Bob's|Colin's] holidays"*
* WhosOutInDepartment *"Who's out in sales today?"*

Architecture

This repo contains a setup script with accompanying files to create the following objects in AWS:
* 6 Lex intents to cover the functionality above
* A slot type for department names which is gathered from Timetastic upon deployment
* A single Lambda function, which handles all of the intents
* The Lex bot itself and an alias
* Any necessary permissions on AWS

The (Node.js) setup script uses the following technologies to deploy Holibot:
* *async* to handle executing all the various asynchronous deployment steps synchronously in order
* *commander* and *promptly* to handle the command line options and validation
* *lodash* to perform various filtering and processing of collections
* the *serverless* framework to package up and deploy all the javascript files which make up the AWS Lambda hander function. 
* the AWS Node.js SDK (of course)

Challenges encountered

I was suprised to find that the actual construction of the bot model in Lex was relatively straightforward once I had
figured out the best ways to answer the various questions and interact accordingly with the Timetastic API.
The hardest challenges in this project came from writing a script to actually deploy the bot. I had chosen the Serverless framework for packaging
my Lambda handler function, but unfortunately Serverless does not support deploying Lex related objects.
Neither does CloudFormation, so I had to write my own calls using the AWS SDK for Node.js to create the intents, bot and alias and apply the
necessary permissions, as well as taking care of removing previous intents, slot types, aliases and bots in case the user was re-deploying.
