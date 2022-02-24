// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { ActivityHandler, MessageFactory } = require('botbuilder');

const { QnAMaker } = require('botbuilder-ai');
const DentistScheduler = require('./dentistscheduler');
const IntentRecognizer = require('./intentrecognizer');

class DentaBot extends ActivityHandler {
    constructor(configuration, qnaOptions) {
        // call the parent constructor
        super();
        if (!configuration) throw new Error('[QnaMakerBot]: Missing parameter. configuration is required');

        // create a QnAMaker connector
        this.QnAMaker = new QnAMaker(configuration.QnAConfiguration, qnaOptions);

        // create a DentistScheduler connector
        this.DentistScheduler = new DentistScheduler(configuration.SchedulerConfiguration);

        // create a IntentRecognizer connector
        this.IntentRecognizer = new IntentRecognizer(configuration.LuisConfiguration);

        this.onMessage(async (context, next) => {
            // send user input to QnA Maker and collect the response in a variable
            // don't forget to use the 'await' keyword
            const qnaResults = await this.QnAMaker.getAnswers(context);

            // send user input to IntentRecognizer and collect the response in a variable
            // don't forget 'await'
            const LuisResult = await this.IntentRecognizer.executeLuisQuery(context);

            // determine which service to respond with based on the results from LUIS //
            if (LuisResult.LuisResult.prediction.topIntent === 'scheduleAppointment' &&
                LuisResult.intents.scheduleAppointment.score > 0.6 &&
                LuisResult.entities.$instance &&
                LuisResult.entities.$instance.time &&
                LuisResult.entities.$instance.time[0]
            ) {
                const time = LuisResult.entities.$instance.time[0].text;
                const day = LuisResult.entities.$instance.day[0].text;
                const date = LuisResult.entities.$instance.date[0].text;
                const getTimeOfAvailability = 'Great! We have an opening on ' + date ? date : day + 'at ' + time + '. See you then!';
                console.log(getTimeOfAvailability);
                await context.sendActivity(getTimeOfAvailability);
                await next();
                return;
            }

            if (qnaResults[0]) {
                console.log(qnaResults[0]);
                await context.sendActivity(`${ qnaResults[0].answer }`);
            } else {
                await context.sendActivity('Im not sure I found an answer to your question. Sorry :(');
            }

            await next();
        });

        this.onMembersAdded(async (context, next) => {
            const membersAdded = context.activity.membersAdded;
            // write a custom greeting
            const welcomeText = 'Heyo! Welcome to Spongebob Dental Clinic. Please ask us any questions, or schedule an appointment with us :D';
            for (let cnt = 0; cnt < membersAdded.length; ++cnt) {
                if (membersAdded[cnt].id !== context.activity.recipient.id) {
                    await context.sendActivity(MessageFactory.text(welcomeText, welcomeText));
                }
            }
            // by calling next() you ensure that the next BotHandler is run.
            await next();
        });
    }
}

module.exports.DentaBot = DentaBot;
