<template>
  <div class="tag-editor">
    <div class="tag-editor__list">
      <span v-for="tag in modelValue" :key="tag" class="tag">
        {{ tag }}
        <button class="tag__remove" @click="removeTag(tag)">×</button>
      </span>
      <input
        v-model="newTag"
        class="tag-editor__input"
        :placeholder="placeholder"
        @keydown.enter.prevent="addTag"
        @keydown.tab.prevent="addTag"
      />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => [],
  },
  placeholder: {
    type: String,
    default: '添加标签...',
  },
})

const emit = defineEmits(['update:modelValue'])

const newTag = ref('')

function addTag() {
  const tag = newTag.value.trim()
  if (tag && !props.modelValue.includes(tag)) {
    emit('update:modelValue', [...props.modelValue, tag])
  }
  newTag.value = ''
}

function removeTag(tag) {
  emit('update:modelValue', props.modelValue.filter(t => t !== tag))
}
</script>

<style scoped>
.tag-editor__list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-xs);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-card);
  min-height: 36px;
  transition: border-color var(--transition-fast);
}

.tag-editor__list:focus-within {
  border-color: var(--border-active);
  box-shadow: var(--glow-cyan);
}

.tag-editor__input {
  background: none;
  border: none;
  color: var(--text-primary);
  font-size: 12px;
  outline: none;
  flex: 1;
  min-width: 80px;
  padding: 2px 4px;
}

.tag-editor__input::placeholder {
  color: var(--text-muted);
}

.tag__remove {
  background: none;
  border: none;
  color: inherit;
  font-size: 13px;
  cursor: pointer;
  padding: 0 2px;
  margin-left: 2px;
  opacity: 0.6;
}

.tag__remove:hover {
  opacity: 1;
}
</style>
