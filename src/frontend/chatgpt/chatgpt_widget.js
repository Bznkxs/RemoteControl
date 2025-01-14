import {maintainScrollToBottom, remindTabLabel, updateElementInfoForScrollToBottom} from "../elements/element_utils.js";

const sampleProblem = "\n" +
    "Problem\n" +
    "\n" +
    "Evirir the dragon snuck into a wizard's castle and found a mysterious contraption, and their playful instincts caused them to play with (destroy) it...\n" +
    "\n" +
    "Evirir the dragon found an array a1,a2,…,an\n" +
    "of n\n" +
    "\n" +
    "non-negative integers.\n" +
    "\n" +
    "In one operation, they can choose a non-empty subarray∗\n" +
    "b of a and replace it with the integer mex(b)†. They want to use this operation any number of times to make a\n" +
    "\n" +
    "only contain zeros. It can be proven that this is always possible under the problem constraints.\n" +
    "\n" +
    "What is the minimum number of operations needed?\n" +
    "\n" +
    "∗\n" +
    "An array c is a subarray of an array d if c can be obtained from d by the deletion of several (possibly, zero or all) elements from the beginning and several (possibly, zero or all) elements from the end.\n" +
    "\n" +
    "†\n" +
    "The minimum excluded (MEX) of a collection of integers f1,f2,…,fk is defined as the smallest non-negative integer x which does not occur in the collection.\n" +
    "\n" +
    "Input\n" +
    "\n" +
    "Each test contains multiple test cases. The first line contains the number of test cases t\n" +
    "(1≤t≤200\n" +
    "\n" +
    "). The description of the test cases follows.\n" +
    "\n" +
    "The first line of each test case contains a single integer n\n" +
    "(1≤n≤50), the length of a\n" +
    "\n" +
    ".\n" +
    "\n" +
    "The second line of each test case contains n\n" +
    "space-separated integers, a1,a2,…,an (0≤ai≤100\n" +
    "\n" +
    ").\n" +
    "\n" +
    "It is guaranteed that the sum of n\n" +
    "over all test cases does not exceed 500\n" +
    "\n" +
    ".\n" +
    "Output\n" +
    "\n" +
    "For each test case, output a single integer on a line, the minimum number of operations needed to make a\n" +
    "\n" +
    "contain only zeros.\n" +
    "Example\n" +
    "Input\n" +
    "\n" +
    "10\n" +
    "4\n" +
    "0 1 2 3\n" +
    "6\n" +
    "0 0 0 0 0 0\n" +
    "5\n" +
    "1 0 1 0 1\n" +
    "5\n" +
    "3 1 4 1 5\n" +
    "4\n" +
    "3 2 1 0\n" +
    "7\n" +
    "9 100 0 89 12 2 3\n" +
    "4\n" +
    "0 3 9 0\n" +
    "7\n" +
    "0 7 0 2 0 7 0\n" +
    "1\n" +
    "0\n" +
    "2\n" +
    "0 1\n" +
    "\n" +
    "Output\n" +
    "\n" +
    "1\n" +
    "0\n" +
    "2\n" +
    "1\n" +
    "1\n" +
    "2\n" +
    "1\n" +
    "2\n" +
    "0\n" +
    "1\n" +
    "\n" +
    "Note\n" +
    "\n" +
    "In the first test case, Evirir can choose the subarray b=[1,2,3]\n" +
    "and replace it with mex(1,2,3)=0, changing a from [0,1,2,3] to [0,0] (where the chosen subarray is underlined). Therefore, the answer is 1\n" +
    "\n" +
    ".\n" +
    "\n" +
    "In the second test case, a\n" +
    "already contains only 0\n" +
    "\n" +
    "s, so no operation is needed.\n" +
    "\n" +
    "In the third test case, Evirir can change a\n" +
    "as follows: [1,0,1,0,1]→[1,2]→[0]. Here, mex(0,1,0,1)=2 and mex(1,2)=0\n" +
    "\n" +
    ".\n" +
    "\n" +
    "In the fourth test case, Evirir can choose b\n" +
    "to be the entire array a, changing a from [3,1,4,1,5] to [0].\n" +
    "\n" +
    "Tutorial:\n" +
    "Case 1: All elements are 0. Then the answer is 0\n" +
    ".\n" +
    "Case 2: Some element is non-zero, and all non-zero elements form a contiguous subarray. Then the answer is 1\n" +
    " since we can choose that subarray and replace it with a 0\n" +
    ".\n" +
    "Case 3: Otherwise, the answer is 2\n" +
    ".\n" +
    " \n" +
    "We can replace the entire array with a non-zero element (since 0\n" +
    " is in the array), then replace the entire array again with a 0\n" +
    " (since the only element left is non-zero).\n" +
    " \n" +
    "1 operation is not enough. If we only use 1 operation, the selected subarray must contain all non-zero elements. Since the non-zero elements do not form a subarray, the selected subarray must contain a 0, thus the MEX will be non-zero.\n" +
    "\n" +
    "Steps:\n" +
    "1. Read the problem. What is the input of each test case, what operation can we perform to the array, and what is the output for each case?\n" +
    "- directions: The answers are in the problem. \n" +
    "- Substeps: \n" +
    "  - What is the input of each test case?\n" +
    "  - What operation can we perform to the array?\n" +
    "  - What is the output for each case?\n" +
    "2. Analyze the operation that involves replacing a subarray with its \"mex\". The problem states that \"It can be proven that this is always possible under the problem constraints.\" Try to explain by giving an upper bound of number of operations.\n" +
    "- answer: We can always reduce the array to only containing 0's in at most 2 operations: (1) select the entire array, and reduce it to mex of the array; (2) if the array isn't full of 0's yet, select the entire array again.\n" +
    "- Hints: \n" +
    "  - is it possible to reduce the array to zero-only in a small number of operations?\n" +
    "  - what happens if you select the entire array?\n" +
    "3. Discuss when the number of operations can be 0 or 1.\n" +
    "- Answer: if the array is full of 0's, then the number of operations is 0; if all the non-zero elements form a continuous subarray, then the number of operations is 1.\n" +
    "- Substeps: \n" +
    "  - When is the number of operations 0?\n" +
    "  - What is the requirement of the subarray we choose if we reduce the array in 1 step?\n" +
    "    - hint: What is the requirement of the values of the elements in this subarray?\n" +
    "4. Write a pseudo-code that describes the entire process.\n" +
    "- direction: the answer should include the three conditions: if the entire array is 0, then the answer is 0; if the non-zero elements are continuous (the pseudo-code should implement how to determine this), then the answer is 1; else the answer is 2.\n"

export class ChatGPTWidget {
    constructor(chatGPTTabPageElementWrapper, chatGPTAPI) {

        const problemDescriptionInput = document.createElement("textarea");
        problemDescriptionInput.id = chatGPTTabPageElementWrapper.id + "-problem-description-input";
        problemDescriptionInput.classList.add("problem-description-input");
        problemDescriptionInput.classList.add("frame");
        chatGPTTabPageElementWrapper.tabContentElement.appendChild(problemDescriptionInput);
        problemDescriptionInput.value = sampleProblem;
        const startChatGPTButton = document.createElement("div");
        startChatGPTButton.id = chatGPTTabPageElementWrapper.id + "-start-chat-gpt-button";
        startChatGPTButton.classList.add("button");
        startChatGPTButton.innerText = "Start ChatGPT";

        chatGPTTabPageElementWrapper.tabContentElement.appendChild(startChatGPTButton);
        const dialogContainer = document.createElement("div");
        dialogContainer.id = chatGPTTabPageElementWrapper.id + "-dialog-container";
        dialogContainer.classList.add("dialog-container");
        dialogContainer.classList.add("logContainer");


        dialogContainer.addEventListener("scroll", () => {
            updateElementInfoForScrollToBottom(dialogContainer);
        });
        const maintainScrollToBottomCallback = (mutationList, observer) => {
            mutationList.forEach((mutation) => {
                if (mutation.type === "attributes" && mutation.attributeName === "class") {
                    return;
                }
                maintainScrollToBottom(dialogContainer);
            });
        }
        const conversationContainerObserver = new MutationObserver(maintainScrollToBottomCallback);
        conversationContainerObserver.observe(dialogContainer,
            {childList: true, attributes: true, subtree: true});
        updateElementInfoForScrollToBottom(dialogContainer);


        chatGPTTabPageElementWrapper.tabContentElement.appendChild(dialogContainer);

        this.chatGPTAPI = chatGPTAPI;
        let currentContentDiv = null;
        let currentContentSpan = null;
        let currentRole = null;
        startChatGPTButton.addEventListener("click", () => {
            const problemDescription = problemDescriptionInput.value;
            dialogContainer.innerHTML = "";
            this.chatGPTAPI.createChatGPT(undefined, problemDescription);
            currentRole = null;
            currentContentDiv = null;
            currentContentSpan = null;
        });
        this.chatGPTAPI.onChatGPTMessage((message) => {

            if (currentContentDiv !== null && currentRole === message.role) {
                currentContentSpan.innerHTML += message.delta;
            }
            else {
                const messageElement = document.createElement("div");
                messageElement.classList.add("messageContainer");
                currentRole = message.role;
                const roleElement = document.createElement("div");
                roleElement.classList.add("metaInfoContainer");
                roleElement.innerText = message.role;
                currentContentDiv = document.createElement("div");
                currentContentDiv.classList.add("messageContentContainer");
                currentContentDiv.classList.add("content-breakable-span");
                currentContentSpan = document.createElement("span");
                currentContentDiv.appendChild(currentContentSpan);
                currentContentSpan.innerHTML = message.delta;
                messageElement.appendChild(roleElement);
                messageElement.appendChild(currentContentDiv);
                dialogContainer.appendChild(messageElement);
            }

        });
    }
}