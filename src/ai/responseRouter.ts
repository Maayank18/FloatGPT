export const responseRouter = {
  routeRequest(prompt: string) {
    const lowercasePrompt = prompt.toLowerCase();
    if (lowercasePrompt.includes('plan') || lowercasePrompt.includes('task')) {
      return 'plan';
    }
    if (lowercasePrompt.includes('what did i') || lowercasePrompt.includes('recall') || lowercasePrompt.includes('remember')) {
      return 'recall';
    }
    return 'chat';
  }
};
