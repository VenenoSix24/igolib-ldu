import json
import csv
import os
import re # Import the regular expression module for filename sanitization

def sanitize_filename(name):
    """Removes characters invalid for filenames and replaces spaces."""
    if not name or not isinstance(name, str):
        return "unknown_library" # Default if name is missing, None, or not a string
    # Remove characters invalid in Windows/Linux/MacOS filenames
    name = re.sub(r'[\\/*?:"<>|]', "", name)
    # Replace consecutive whitespace with a single underscore
    name = re.sub(r'\s+', '_', name)
    # Remove leading/trailing underscores/whitespace
    name = name.strip('_ ')
    # Ensure the filename is not empty after sanitization
    return name if name else "unknown_library"

def extract_and_export_mappings(input_filepath, output_directory, output_format='json'):
    """
    Reads JSON, extracts coordinate-to-seat_name mappings, REVERSES them to
    seat_name-to-coordinate, and exports the reversed mappings to a file
    named after the 'lib_name' in the specified output directory.

    Args:
        input_filepath (str): Path to the input JSON file.
        output_directory (str): Path to the directory where output files will be saved.
        output_format (str): Format for the output file ('json', 'csv', 'txt').

    Returns:
        bool: True if successful, False otherwise.
    """
    print(f"开始处理输入文件: {input_filepath}")
    # This dictionary will initially store {coordinate: seat_name} during extraction
    original_mappings = {}
    processed_count = 0
    skipped_null_empty_count = 0
    skipped_missing_key_count = 0
    skipped_not_dict_count = 0
    libs_processed_count = 0
    base_output_filename = "output"

    # --- 1. Read, Parse, Find Library Name, and Extract ORIGINAL Mappings ---
    try:
        if not os.path.exists(input_filepath):
             print(f"错误: 输入文件未找到 {input_filepath}")
             return False

        with open(input_filepath, 'r', encoding='utf-8') as f:
            try:
                full_data = json.load(f)
            except json.JSONDecodeError as e:
                print(f"\n错误: 文件 {input_filepath} 包含无效的 JSON 数据: {e}")
                return False

            if not isinstance(full_data, dict):
                print(f"错误: 文件 {input_filepath} 的顶层结构不是一个 JSON 对象。")
                return False

            libs_list = full_data.get('data', {}).get('userAuth', {}).get('reserve', {}).get('libs')

            if not isinstance(libs_list, list):
                print(f"错误: 在 JSON 结构中未找到 'data.userAuth.reserve.libs' 或其值不是列表。")
                return False

            # Determine Output Filename from the first library
            if libs_list:
                 first_lib_data = libs_list[0]
                 if isinstance(first_lib_data, dict):
                     lib_name = first_lib_data.get('lib_name')
                     base_output_filename = sanitize_filename(lib_name)
                     print(f"信息: 将使用第一个自习室名称 '{lib_name}' (处理后为 '{base_output_filename}') 作为输出文件名。")
                 else:
                     print("警告: 'libs' 列表的第一个元素不是字典，将使用默认输出文件名 'output'。")
            else:
                print("警告: 'libs' 列表为空，将使用默认输出文件名 'output'。")

            # Construct the full output path
            output_filepath = os.path.join(output_directory, f"{base_output_filename}.{output_format}")
            print(f"信息: 完整输出文件路径将是: {output_filepath}")

            # Process seats from ALL libraries to populate original_mappings
            if not libs_list:
                 print("警告: 'libs' 列表为空，没有可处理的自习室信息。")

            for lib_index, lib_data in enumerate(libs_list):
                if not isinstance(lib_data, dict):
                    print(f"警告: 'libs' 列表中的第 {lib_index + 1} 个元素不是字典，已跳过。")
                    continue

                libs_processed_count += 1
                current_lib_name = lib_data.get('lib_name', f'未命名自习室 {lib_index + 1}')
                seats_list = lib_data.get('lib_layout', {}).get('seats')

                if not isinstance(seats_list, list):
                    # print(f"警告: 自习室 '{current_lib_name}' 中未找到 'lib_layout.seats' 或其值不是列表。跳过处理。") # Reduce noise
                    continue
                if not seats_list:
                     continue

                for seat_index, item in enumerate(seats_list):
                    if isinstance(item, dict):
                        coord_key = item.get('key')
                        seat_name = item.get('name') # This is the seat number (e.g., "211")
                        # Ensure seat_name is a string before using it as a key later
                        if isinstance(seat_name, (int, float)):
                            seat_name = str(seat_name)

                        if coord_key is not None and seat_name and isinstance(seat_name, str):
                            if coord_key in original_mappings:
                                print(f"  警告: 坐标键 '{coord_key}' 重复 (之前 '{original_mappings[coord_key]}', 现在 '{seat_name}' 来自 '{current_lib_name}'). 已覆盖。")
                            original_mappings[coord_key] = seat_name # Store original mapping
                            processed_count += 1
                        elif coord_key is None:
                             skipped_missing_key_count +=1
                        elif seat_name is None or seat_name == "":
                             skipped_null_empty_count += 1
                        else:
                             skipped_missing_key_count += 1 # Covers case where seat_name isn't stringifiable implicitly
                    else:
                        skipped_not_dict_count += 1

    except FileNotFoundError:
        print(f"错误: 输入文件未找到 {input_filepath}")
        return False
    except Exception as e:
        print(f"读取或解析文件 {input_filepath} 时发生意外错误: {e}")
        return False

    # --- Summary (Based on original extraction) ---
    total_skipped = skipped_null_empty_count + skipped_missing_key_count + skipped_not_dict_count
    print(f"\n--- 数据提取总结 (原始: 坐标 -> 座位号) ---")
    print(f"  处理的自习室数量: {libs_processed_count}")
    print(f"  成功提取的原始映射数量: {processed_count} (来自 {len(original_mappings)} 个唯一坐标)")
    print(f"  跳过的座位条目总数: {total_skipped}")
    # ... (skipped counts remain the same) ...

    if not original_mappings and processed_count == 0:
         print("警告: 未能从输入文件中提取任何有效的 key-name 映射。无法继续导出。")
         # Try to create an empty file based on lib_name? Or just return False?
         # Let's try creating empty file for consistency, but warn heavily.
         try:
             os.makedirs(output_directory, exist_ok=True)
             with open(output_filepath, 'w', encoding='utf-8', newline='') as f:
                 if output_format == 'json':
                     f.write("{\n}") # Empty JSON object
                 elif output_format == 'csv':
                     writer = csv.writer(f)
                     writer.writerow(['seat_name', 'coordinate']) # Still write header
                 # TXT will just be empty
             print(f"警告: 由于未提取到数据，已创建空的输出文件: {output_filepath}")
             return True # Return True because file creation was attempted
         except Exception as e_empty:
             print(f"尝试创建空输出文件时出错: {e_empty}")
             return False


    # --- <<< REVERSE THE MAPPINGS >>> ---
    print("\n正在反转映射关系 (座位号 -> 坐标)...")
    reversed_mappings = {}
    duplicate_seat_number_count = 0
    for coord_key, seat_name in original_mappings.items():
        # seat_name (e.g., "211") becomes the key
        # coord_key (e.g., "44,11") becomes the value
        if seat_name in reversed_mappings:
            print(f"  警告: 座位号 '{seat_name}' 在多个坐标键中重复出现 (之前 '{reversed_mappings[seat_name]}', 现在 '{coord_key}')。将使用后出现的坐标键 '{coord_key}'。")
            duplicate_seat_number_count += 1
        reversed_mappings[seat_name] = coord_key

    print(f"  成功反转 {len(reversed_mappings)} 个唯一座位号的映射。")
    if duplicate_seat_number_count > 0:
        print(f"  注意: 检测到 {duplicate_seat_number_count} 个重复的座位号，已使用最后遇到的坐标键进行映射。")
    # --- End Reversal ---

    # --- 2. Export REVERSED Mappings using the generated output_filepath ---
    print(f"\n准备将 {len(reversed_mappings)} 个 *反转后* 的映射 (座位号 -> 坐标) 导出到: {output_filepath} (格式: {output_format})")
    try:
        os.makedirs(output_directory, exist_ok=True)
        print(f"确保输出目录存在: {output_directory}")

        with open(output_filepath, 'w', encoding='utf-8', newline='') as f:
            if output_format == 'json':
                # Dump the reversed dictionary
                json.dump(reversed_mappings, f, ensure_ascii=False, indent=4)
            elif output_format == 'csv':
                writer = csv.writer(f)
                # Update headers to reflect the new order
                writer.writerow(['seat_name', 'coordinate'])
                # Iterate through the reversed dictionary
                for seat_name, coord_key in reversed_mappings.items():
                    writer.writerow([seat_name, coord_key]) # Write in seat_name, coordinate order
            elif output_format == 'txt':
                 # Iterate through the reversed dictionary
                 for seat_name, coord_key in reversed_mappings.items():
                     f.write(f"{seat_name} : {coord_key}\n") # Write in seat_name : coordinate order
            else:
                print(f"错误: 不支持的输出格式 '{output_format}'.")
                return False

        print(f"结果已成功导出到: {output_filepath}")
        return True

    except IOError as e:
        print(f"错误: 无法写入输出文件 {output_filepath}. 错误信息: {e}")
        return False
    except Exception as e:
        print(f"导出结果时发生意外错误: {e}")
        return False

# --- Usage Example (remains the same) ---

# 1. Specify input file
input_json_file = 'seat_data_array.json'

# 2. Specify output directory
output_dir = 'output/'

# 3. (Optional) Create sample input file

# 4. Call the function
print("-" * 30)
success_json = extract_and_export_mappings(input_json_file, output_dir, output_format='json')
print("-" * 30)
success_csv = extract_and_export_mappings(input_json_file, output_dir, output_format='csv')
print("-" * 30)
success_txt = extract_and_export_mappings(input_json_file, output_dir, output_format='txt')
print("-" * 30)

# 5. Check results
print("--- 导出状态 ---")
if success_json: print(f"JSON 导出操作完成。")
else: print("JSON 导出操作失败或未执行。")
if success_csv: print(f"CSV 导出操作完成。")
else: print("CSV 导出操作失败或未执行。")
if success_txt: print(f"TXT 导出操作完成。")
else: print("TXT 导出操作失败或未执行。")
print(f"请在目录 '{os.path.abspath(output_dir)}' 中查找基于自习室名称命名的输出文件。")
if not success_json or not success_csv or not success_txt:
    print("\n警告：至少有一个导出步骤失败。请检查上面的错误信息。")