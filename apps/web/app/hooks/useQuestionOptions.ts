import { useCallback } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { QuizLessonFormValues } from "~/modules/Admin/EditCourse/CourseLessons/NewLesson/QuizLessonForm/validators/quizLessonFormSchema";
import type { QuestionOption } from "~/modules/Admin/EditCourse/CourseLessons/NewLesson/QuizLessonForm/QuizLessonForm.types";

/**
 * Custom hook to manage quiz question options
 * Eliminates code duplication across question components
 */
export const useQuestionOptions = (
  form: UseFormReturn<QuizLessonFormValues>,
  questionIndex: number,
) => {
  const handleAddOption = useCallback(() => {
    const currentOptions: QuestionOption[] =
      form.getValues(`questions.${questionIndex}.options`) || [];

    const newOption: QuestionOption = {
      sortableId: crypto.randomUUID(),
      optionText: "",
      isCorrect: false,
      displayOrder: currentOptions.length + 1,
    };

    form.setValue(`questions.${questionIndex}.options`, [...currentOptions, newOption], {
      shouldDirty: true,
      shouldValidate: true,
    });
  }, [form, questionIndex]);

  const handleRemoveOption = useCallback(
    (optionIndex: number) => {
      const currentOptions: QuestionOption[] =
        form.getValues(`questions.${questionIndex}.options`) || [];
      const updatedOptions = currentOptions.filter((_, index) => index !== optionIndex);

      form.setValue(`questions.${questionIndex}.options`, updatedOptions, {
        shouldDirty: true,
        shouldValidate: true,
      });
    },
    [form, questionIndex],
  );

  const handleRemoveQuestion = useCallback(() => {
    const currentQuestions = form.getValues("questions") || [];
    const updatedQuestions = currentQuestions.filter((_, index) => index !== questionIndex);

    form.setValue("questions", updatedQuestions, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }, [form, questionIndex]);

  const isOptionEmpty = useCallback(() => {
    const options = form.getValues(`questions.${questionIndex}.options`);
    return !Array.isArray(options) || options.length === 0;
  }, [form, questionIndex]);

  return {
    handleAddOption,
    handleRemoveOption,
    handleRemoveQuestion,
    isOptionEmpty,
  };
};
